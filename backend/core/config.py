from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor the .env lookup to backend/.env regardless of the process's working
# directory (uvicorn from repo root, a worker script, Docker, a service unit).
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

# Groq serves an OpenAI-compatible API; both the classifier and the research
# fallback talk to it through the openai SDK.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class Settings(BaseSettings):
    # extra="ignore": a stray key in .env must not crash startup.
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    supabase_url: str
    supabase_service_key: str
    gemini_api_key: str
    tavily_api_key: str
    groq_api_key: str | None = None
    # One origin, or a comma-separated list, allowed to call the API from a browser.
    frontend_origin: str = "http://localhost:5173"

    @property
    def frontend_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
