import json
import re
import logging
import time
from collections import defaultdict, deque
from typing import List, Optional

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, TooManyRequests
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from database import settings

# ── Configuración ──────────────────────────────────────────────────────────────

GEMINI_ENABLED = bool(settings.GEMINI_API_KEY)
if GEMINI_ENABLED:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    _model = genai.GenerativeModel("gemini-2.0-flash")
else:
    _model = None

CHAT_SYSTEM_PROMPT = """
Eres GastroBot, el asistente amigable de GastroIA, una app de pedidos de comida.
Tu objetivo es ayudar al usuario a descubrir qué quiere comer HOY mediante
una conversación corta y natural en español.

Reglas estrictas:
1. Haz UNA sola pregunta por respuesta, corta y directa.
2. Máximo 3 preguntas antes de dar recomendaciones.
3. Cuando ya tengas suficiente información (mínimo saber si quiere algo salado/dulce,
   caliente/frío, o alguna categoría), incluye al final de tu respuesta la línea:
   LISTO_JSON: {"search":"...","dietType":"omnivoro|vegetariano|vegano","allergies":[],"budget":null,"message":"..."}
4. El JSON debe estar en una sola línea sin espacios extra.
5. No menciones precios a menos que el usuario lo pregunte.
6. Sé cálido, usa emojis ocasionalmente, máximo 2 por mensaje.
7. Si el usuario ya sabe qué quiere desde el primer mensaje, ve directo al JSON.
"""

if GEMINI_ENABLED:
    _chat_model = genai.GenerativeModel(
        "gemini-2.0-flash",
        system_instruction=CHAT_SYSTEM_PROMPT,
    )
else:
    _chat_model = None

# Configurar logging con más detalle
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

if GEMINI_ENABLED:
    logger.info("✓ Google Gemini configurado correctamente")
    logger.info("  API_KEY: configurada")
    logger.info("  Modelo: gemini-2.0-flash")
else:
    logger.warning("⚠️ GEMINI_API_KEY no configurada. Se usará IA local de respaldo.")

router = APIRouter(prefix="/ai", tags=["IA"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    search: str
    dietType: str          # "omnivoro" | "vegetariano" | "vegano"
    allergies: List[str]
    budget: Optional[int]  # en COP, None si no mencionó
    message: str           # respuesta natural para mostrar al usuario


class ChatMessage(BaseModel):
    role: str   # "user" | "model"
    text: str


class ChatRequest(BaseModel):
    history: List[ChatMessage]
    message: str


class ChatResponse(BaseModel):
    reply: str
    resolved: bool         # True cuando Gemini ya tiene suficiente info
    preferences: Optional[AnalyzeResponse] = None


RATE_LIMIT_MESSAGE = "¡Vas muy rápido! Por favor, espera unos segundos antes de enviar otro mensaje."

RATE_WINDOWS_SECONDS = {
    "analyze": 60,
    "chat": 60,
}

RATE_MAX_REQUESTS = {
    "analyze": 40,
    "chat": 25,
}

_rate_limiter_store: dict[str, deque[float]] = defaultdict(deque)


def _client_key(request: Request, action: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    return f"{action}:{client_host}"


def _check_rate_limit(request: Request, action: str) -> None:
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
            detail=RATE_LIMIT_MESSAGE,
        )

    attempts.append(now)

LOCAL_STOPWORDS = {
    "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "con",
    "sin", "para", "por", "en", "al", "del", "me", "quiero", "quisiera", "busco",
    "algo", "comida", "plato", "platillo", "comer", "cenar", "almorzar", "desayunar",
    "hoy", "ahora", "favor", "te", "apetece", "antojo"
}

LOCAL_DIET_KEYWORDS = {
    "vegano": "vegano",
    "vegana": "vegano",
    "vegetariano": "vegetariano",
    "vegetariana": "vegetariano",
}

LOCAL_ALLERGY_KEYWORDS = {
    "gluten": ["gluten", "trigo", "pan", "pizza", "pasta", "masa"],
    "lacteos": ["lacteo", "lacteos", "leche", "queso", "yogur", "mantequilla", "crema"],
    "huevo": ["huevo", "mayonesa", "omelet", "tortilla"],
    "mariscos": ["marisco", "mariscos", "camaron", "camarones", "langostino", "mejillon", "almeja"],
    "pescado": ["pescado", "atun", "salmon", "sashimi", "ceviche"],
    "soya": ["soya", "soja", "miso", "tamari", "edamame"],
    "mani": ["mani", "cacahuate", "cacahuetes", "peanut"],
    "nueces": ["nuez", "nueces", "almendra", "avellana", "pistacho"],
}


def _normalize_text(text: str) -> str:
    normalized = text.lower()
    normalized = re.sub(r"[áàäâ]", "a", normalized)
    normalized = re.sub(r"[éèëê]", "e", normalized)
    normalized = re.sub(r"[íìïî]", "i", normalized)
    normalized = re.sub(r"[óòöô]", "o", normalized)
    normalized = re.sub(r"[úùüû]", "u", normalized)
    normalized = re.sub(r"ñ", "n", normalized)
    return normalized


def _sanitize_search_terms(search: str) -> str:
    """Elimina tokens repetidos (especialmente consecutivos) en el texto de búsqueda."""
    if not search:
        return ""

    words = [token for token in re.split(r"\s+", search.strip()) if token]
    cleaned: List[str] = []
    seen = set()

    for word in words:
        normalized_word = _normalize_text(word)
        if normalized_word in seen:
            continue
        seen.add(normalized_word)
        cleaned.append(word)

    return " ".join(cleaned)


def _sanitize_preferences(preferences: AnalyzeResponse) -> AnalyzeResponse:
    """Normaliza campos para evitar búsquedas redundantes."""
    preferences.search = _sanitize_search_terms(preferences.search)
    return preferences


def _local_fallback_preferences(text: str) -> AnalyzeResponse:
    normalized = _normalize_text(text)
    tokens = [token for token in re.split(r"[^a-z0-9]+", normalized) if token and token not in LOCAL_STOPWORDS]

    diet_type = "omnivoro"
    for key, value in LOCAL_DIET_KEYWORDS.items():
        if key in normalized:
            diet_type = value
            break

    allergies: List[str] = []
    for allergy, keywords in LOCAL_ALLERGY_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            allergies.append(allergy)

    budget_match = re.search(r"\b(\d{2,6})\b", normalized)
    budget = int(budget_match.group(1)) if budget_match else None

    if tokens:
        search_tokens = tokens[:4]
        search = " ".join(search_tokens)
    else:
        search = ""

    if search:
        message = f"Encontré una pista rápida: {search}. Voy a buscar opciones para ti."
    else:
        message = "¿Te apetece algo salado, dulce, ligero o contundente?"

    return AnalyzeResponse(
        search=search,
        dietType=diet_type,
        allergies=allergies,
        budget=budget,
        message=message,
    )


def _local_chat_response(data: ChatRequest) -> ChatResponse:
    current_text = data.message or ""
    if data.history:
        last_user_messages = [msg.text for msg in data.history if msg.role == "user" and msg.text]
        if last_user_messages:
            last_user_text = last_user_messages[-1].strip()
            current_clean = current_text.strip()
            if _normalize_text(last_user_text) != _normalize_text(current_clean):
                current_text = f"{last_user_text} {current_clean}".strip()

    preferences = _sanitize_preferences(_local_fallback_preferences(current_text))
    has_clear_signal = bool(preferences.search or preferences.allergies or preferences.budget is not None or preferences.dietType != "omnivoro")

    if has_clear_signal:
        return ChatResponse(
            reply=preferences.message,
            resolved=True,
            preferences=preferences,
        )

    return ChatResponse(reply=preferences.message, resolved=False)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    """Extrae el primer bloque JSON de la respuesta de Gemini."""
    if not raw or not raw.strip():
        logger.error("❌ Respuesta vacía de Gemini")
        raise ValueError("Gemini devolvió una respuesta vacía")
    
    logger.debug(f"🔍 Buscando JSON en respuesta ({len(raw)} chars)...")
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", raw, re.DOTALL)
    
    if not match:
        logger.error(f"❌ No se encontró JSON válido en: {raw[:200]}...")
        raise ValueError("Gemini no devolvió JSON válido")
    
    json_str = match.group()
    logger.debug(f"📦 JSON encontrado: {json_str[:100]}...")
    
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"❌ Error al parsear JSON: {str(e)}")
        logger.debug(f"   JSON inválido: {json_str}")
        raise ValueError(f"JSON inválido: {str(e)}")


def _log_token_usage(response, endpoint: str) -> None:
    """Registra metadata de tokens cuando Gemini la expone en la respuesta."""
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        logger.info("ℹ️ %s sin metadata de tokens en la respuesta", endpoint)
        return

    prompt_tokens = (
        getattr(usage, "prompt_token_count", None)
        or getattr(usage, "promptTokenCount", None)
    )
    output_tokens = (
        getattr(usage, "candidates_token_count", None)
        or getattr(usage, "candidatesTokenCount", None)
    )
    total_tokens = (
        getattr(usage, "total_token_count", None)
        or getattr(usage, "totalTokenCount", None)
    )

    logger.info(
        "📊 %s tokens -> prompt=%s output=%s total=%s",
        endpoint,
        prompt_tokens if prompt_tokens is not None else "N/D",
        output_tokens if output_tokens is not None else "N/D",
        total_tokens if total_tokens is not None else "N/D",
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_intent(data: AnalyzeRequest, request: Request):
    """
    Recibe texto libre del usuario y devuelve preferencias estructuradas
    para que el sistema de filtros pueda encontrar los platos correctos.
    """
    _check_rate_limit(request, "analyze")
    logger.debug(f"📝 Analizando intent: '{data.text[:50]}...'")
    
    if not data.text or not data.text.strip():
        logger.warning("❌ Texto vacío recibido en /analyze")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El texto no puede estar vacío")

    prompt = f"""
Eres el asistente de una app de pedidos de comida llamada GastroIA.
Analiza este mensaje del usuario y extrae sus preferencias alimentarias.

Mensaje: "{data.text}"

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{{
  "search": "<palabras clave para buscar en el menú, en español, máx 4 palabras>",
  "dietType": "<omnivoro|vegetariano|vegano>",
  "allergies": ["<alergia1>", "<alergia2>"],
  "budget": <número en COP o null si no mencionó>,
  "message": "<respuesta amigable de 1 oración para mostrar al usuario, en español>"
}}

Reglas:
- Si no menciona dieta, usa "omnivoro"
- Si no menciona alergias, usa []
- Si no menciona presupuesto, usa null
- El campo "search" debe ser lo más descriptivo posible para encontrar platos
"""

    if not GEMINI_ENABLED or _model is None:
        logger.info("ℹ️ /analyze usando fallback local (Gemini no configurado)")
        return _sanitize_preferences(_local_fallback_preferences(data.text))

    try:
        logger.debug("🤖 Enviando prompt a Gemini...")
        response = _model.generate_content(prompt)
        _log_token_usage(response, "/ai/analyze")
        logger.debug(f"✓ Respuesta recibida: {response.text[:80]}...")
        
        data_dict = _extract_json(response.text)
        result = _sanitize_preferences(AnalyzeResponse(**data_dict))
        logger.info(f"✅ Intent analizado: diet={result.dietType}, budget={result.budget}")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON inválido en respuesta de Gemini: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini devolvió formato inválido: {str(e)}"
        )
    except ValueError as e:
        logger.error(f"❌ No se encontró JSON válido: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo extraer JSON: {str(e)}"
        )
    except ResourceExhausted as exc:
        logger.error(f"❌ Cuota agotada en /analyze: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="La cuota de Gemini está agotada temporalmente. Intenta de nuevo en unos minutos."
        )
    except Exception as exc:
        logger.warning(
            "⚠️ Error en Gemini /analyze (%s). Aplicando fallback local.",
            type(exc).__name__,
            exc_info=True,
        )
        return _sanitize_preferences(_local_fallback_preferences(data.text))


@router.post("/chat", response_model=ChatResponse)
def chat_with_assistant(data: ChatRequest, request: Request):
    """
    Chat conversacional guiado. Gemini hace preguntas cortas al usuario
    para descubrir qué quiere comer. Cuando tiene suficiente info,
    devuelve resolved=True con las preferencias estructuradas.
    """
    _check_rate_limit(request, "chat")
    # ✅ VALIDACIÓN DE ENTRADA
    logger.debug(f"💬 Nueva solicitud de chat - Historial: {len(data.history)} mensajes, Mensaje: '{data.message[:50]}...'")
    
    if not data.message or not data.message.strip():
        logger.warning("❌ Mensaje vacío recibido en /chat")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje no puede estar vacío")
    
    if not isinstance(data.history, list):
        logger.warning("❌ Historial no es una lista válida")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El historial debe ser una lista")
    
    if not GEMINI_ENABLED or _chat_model is None:
        logger.info("ℹ️ /chat usando fallback local (Gemini no configurado)")
        return _local_chat_response(data)

    # Construir historial para el modelo
    try:
        logger.debug("📋 Construyendo historial para Gemini...")
        history_for_gemini = []
        for i, msg in enumerate(data.history):
            if not msg.role or not msg.text:
                logger.warning(f"⚠️  Mensaje #{i} incompleto - role: '{msg.role}', text: '{msg.text[:20]}...'")
                continue

            if msg.role not in {"user", "model"}:
                logger.warning(f"⚠️  Mensaje #{i} con rol inválido: '{msg.role}'")
                continue

            history_for_gemini.append({
                "role": msg.role,
                "parts": [msg.text]
            })
        logger.debug(f"✓ Historial procesado: {len(history_for_gemini)} mensajes válidos")

        # ✅ ENVIAR A GEMINI CON LOGGING DETALLADO
        logger.debug("🤖 Iniciando chat con Gemini...")
        chat = _chat_model.start_chat(history=history_for_gemini)
        logger.debug(f"📤 Enviando mensaje de usuario ({len(data.message)} caracteres)...")

        response = chat.send_message(data.message)
        _log_token_usage(response, "/ai/chat")
        reply_text = response.text
        logger.debug(f"✓ Respuesta recibida ({len(reply_text)} caracteres): {reply_text[:100]}...")

        # Detectar si Gemini ya resolvió las preferencias
        json_match = re.search(r"LISTO_JSON:\s*(\{[^}]*\})", reply_text, re.DOTALL)
        if json_match:
            logger.debug("🎯 Preferencias detectadas en respuesta")
            try:
                prefs_dict = json.loads(json_match.group(1))
                clean_reply = reply_text[:json_match.start()].strip()
                result = ChatResponse(
                    reply=clean_reply or prefs_dict.get("message", "¡Encontré algo para ti!"),
                    resolved=True,
                    preferences=_sanitize_preferences(AnalyzeResponse(**prefs_dict)),
                )
                logger.info(f"✅ Chat resuelto con preferencias: {prefs_dict.get('dietType', 'N/A')}")
                return result
            except json.JSONDecodeError as e:
                logger.error(f"❌ JSON inválido en LISTO_JSON: {str(e)}")
                logger.debug(f"   Contenido JSON extraído: {json_match.group(1)}")

        logger.info(f"✅ Chat respondido (sin resolver)")
        return ChatResponse(reply=reply_text, resolved=False)

    except HTTPException:
        raise  # Re-lanzar HTTPExceptions tal cual
    except TooManyRequests as exc:
        logger.warning(f"⚠️ Rate limit de Gemini en /chat: {str(exc)}")
        return _local_chat_response(data)
    except ResourceExhausted as exc:
        logger.warning(f"⚠️ Cuota/rate limit de Gemini en /chat: {str(exc)}")
        return _local_chat_response(data)
        
    except Exception as exc:
        logger.error(f"❌ Error inesperado en /chat: {type(exc).__name__}: {str(exc)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error en chat con Gemini: {str(exc)}"
        )
