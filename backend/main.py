import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from database import engine, Base
from routers import restaurants, menus, orders, auth, ai, owner


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Garantiza que el esquema base exista antes de atender requests.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="GastroIA API",
    description="Backend para la aplicación de restaurantes GastroIA",
    version="1.0.0",
    lifespan=lifespan,
)


def _get_allowed_origins() -> list[str]:
    """Resuelve orígenes permitidos para CORS en desarrollo/producción."""
    env_origins = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if env_origins:
        origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
        if origins:
            return origins

    return [
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# CORS abierto para facilitar desarrollo local desde Expo/Web.
# En produccion se recomienda restringir allow_origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Añade cabeceras de seguridad HTTP sin afectar el comportamiento funcional."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Registro explicito de modulos de dominio.
app.include_router(restaurants.router)
app.include_router(menus.router)
app.include_router(orders.router)
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(owner.router)


@app.get("/", tags=["Estado"])
def health_check():
    return {"status": "ok", "message": "GastroIA API funcionando correctamente"}


if __name__ == "__main__":
    # En Windows, ejecutar reload=True desde `python main.py` puede producir
    # trazas ruidosas del proceso de recarga aunque la app termine iniciando.
    # Se deja desactivado por defecto y configurable por entorno.
    reload_enabled = os.getenv("UVICORN_RELOAD", "false").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=reload_enabled)
