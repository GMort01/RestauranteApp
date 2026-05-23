import google.generativeai as genai
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field

_ENV_FILE = Path(__file__).parent / ".env"

class Settings(BaseSettings):
    GEMINI_API_KEY: Optional[str] = Field(default=None, env="GEMINI_API_KEY")
    
    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"

settings = Settings()

if not settings.GEMINI_API_KEY:
    print("No hay GEMINI_API_KEY en backend/.env. Configúrala para listar modelos.")
    raise SystemExit(0)

genai.configure(api_key=settings.GEMINI_API_KEY)

print("🔍 Listando modelos disponibles...")
print("=" * 60)

for model in genai.list_models():
    if "generateContent" in model.supported_generation_methods:
        print(f"✓ {model.name}")
        print(f"  Display: {model.display_name}")
        print(f"  Version: {model.version}")
        print()
