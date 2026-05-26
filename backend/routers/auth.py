import hashlib
import hmac
import secrets
import time
import uuid
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas

router = APIRouter(prefix="/auth", tags=["Auth"])

RATE_WINDOWS_SECONDS = {
    "register": 60,
    "login": 60,
    "reset_password": 300,
}

RATE_MAX_REQUESTS = {
    "register": 6,
    "login": 8,
    "reset_password": 5,
}

_rate_limiter_store: dict[str, deque[float]] = defaultdict(deque)


def _client_key(request: Request, action: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{action}:{client_host}"


def _check_rate_limit(request: Request, action: str) -> None:
    # Aplica rate limit por IP y acción para proteger registro, login y reset.
    now = time.monotonic()
    window = RATE_WINDOWS_SECONDS[action]
    max_requests = RATE_MAX_REQUESTS[action]
    key = _client_key(request, action)
    attempts = _rate_limiter_store[key]

    while attempts and (now - attempts[0]) > window:
        attempts.popleft()

    if len(attempts) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espera un momento e inténtalo de nuevo.",
        )

    attempts.append(now)


def normalize_email(email: str) -> str:
    # Normaliza para evitar duplicados por mayusculas/espacios.
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    return bool(email) and "@" in email and "." in email.split("@")[-1]


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()


def create_password_record(password: str) -> tuple[str, str]:
    # Cada usuario recibe salt unica para endurecer hash contra rainbow tables.
    salt = secrets.token_hex(16)
    return hash_password(password, salt), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    # compare_digest evita comparaciones vulnerables a timing attacks.
    computed_hash = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, password_hash)


def serialize_user(user: models.User) -> schemas.UserResponse:
    return schemas.UserResponse(id=user.id, name=user.name, email=user.email)


@router.post("/register", response_model=schemas.AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(data: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    # Valida input, unicidad de correo y persiste el usuario con hash y salt propios.
    _check_rate_limit(request, "register")
    name = data.name.strip()
    email = normalize_email(data.email)
    password = data.password.strip()

    if not name or not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completa nombre, correo y contraseña",
        )

    if not is_valid_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingresa un correo válido",
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 6 caracteres",
        )

    # Valida unicidad de correo antes de crear la cuenta.
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo",
        )

    password_hash, password_salt = create_password_record(password)
    user = models.User(
        id=str(uuid.uuid4()),
        name=name,
        email=email,
        password_hash=password_hash,
        password_salt=password_salt,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return schemas.AuthResponse(user=serialize_user(user), message="Usuario registrado correctamente")


@router.post("/login", response_model=schemas.AuthResponse)
def login_user(data: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    # Autentica con mensaje genérico para no revelar si el correo existe en el sistema.
    _check_rate_limit(request, "login")
    email = normalize_email(data.email)
    password = data.password.strip()

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completa correo y contraseña",
        )

    if not is_valid_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingresa un correo válido",
        )

    # El mensaje de error es generico para no filtrar si el correo existe o no.
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(password, user.password_hash, user.password_salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    return schemas.AuthResponse(user=serialize_user(user), message="Sesión iniciada correctamente")


@router.post("/reset-password")
def reset_password(data: schemas.UserResetPassword, request: Request, db: Session = Depends(get_db)):
    # Reemplaza hash y salt de la contraseña después de validar correo y reglas mínimas.
    _check_rate_limit(request, "reset_password")
    email = normalize_email(data.email)
    new_password = data.new_password.strip()

    if not email or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completa correo y nueva contraseña",
        )

    if not is_valid_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingresa un correo válido",
        )

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 6 caracteres",
        )

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una cuenta con ese correo",
        )

    password_hash, password_salt = create_password_record(new_password)
    user.password_hash = password_hash
    user.password_salt = password_salt
    db.commit()

    return {"message": "Contraseña actualizada correctamente"}
