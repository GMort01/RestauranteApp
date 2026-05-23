import logging
from pathlib import Path
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from pydantic import Field
from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    # Variables de conexión: se leen desde .env en entorno local.
    DB_HOST: str = Field(..., env="DB_HOST")
    DB_PORT: int = Field(..., env="DB_PORT")
    DB_USER: str = Field(..., env="DB_USER")
    DB_PASSWORD: str = Field(..., env="DB_PASSWORD")
    DB_NAME: str = Field(..., env="DB_NAME")

    # Variables de Google Gemini
    GEMINI_API_KEY: Optional[str] = Field(default=None, env="GEMINI_API_KEY")
    GEMINI_API_URL: str = Field(
        default="https://generativelanguage.googleapis.com", env="GEMINI_API_URL"
    )

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"


settings = Settings()

# SQLAlchemy usa esta URL para crear el engine de MySQL.
DATABASE_URL = (
    f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)

engine = create_engine(DATABASE_URL, echo=False)

# SessionLocal es la fabrica de sesiones por request.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    # Dependencia de FastAPI: entrega una sesion y la cierra al finalizar.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Log de configuración
logging.basicConfig(level=logging.INFO)
if settings.GEMINI_API_KEY:
    logging.info("Cargando configuración: GEMINI_API_KEY configurada, GEMINI_API_URL=%s", settings.GEMINI_API_URL)
else:
    logging.warning(
        "GEMINI_API_KEY no configurada. La IA funcionará en modo fallback local."
    )
