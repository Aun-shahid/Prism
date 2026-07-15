import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from cryptography.fernet import Fernet

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_FILE)


def _ensure_encryption_key() -> str:
    """Auto-generate a Fernet encryption key if one isn't set in the environment."""
    key = os.environ.get("ENCRYPTION_KEY", "")
    if not key:
        key = Fernet.generate_key().decode("utf-8")
        # Persist to .env so it survives restarts
        with open(ENV_FILE, "a") as f:
            f.write(f"\nENCRYPTION_KEY={key}\n")
        os.environ["ENCRYPTION_KEY"] = key
    return key


class Settings(BaseSettings):
    # --- Database ---
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "prism"

    # --- Auth / JWT ---
    SECRET_KEY: str = "8f0fa3c3f305086ee7149a463d11b5e28a58e0a174dfcd3a49216091db58032c"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    TIMEZONE: str = "UTC"

    # --- Encryption (auto-generated if empty) ---
    ENCRYPTION_KEY: str = ""

    # --- Gmail OAuth (placeholders) ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/gmail/callback"

    # --- Frontend (for redirecting back after OAuth callbacks) ---
    FRONTEND_URL: str = "http://localhost:3000"

    # --- Scraper ---
    # Base cadence for per-company target scrapes; general feeds run at 2x this.
    SCRAPER_INTERVAL_HOURS: int = 4

    # --- CORS Allowed Origins ---
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Auto-generate encryption key before creating Settings instance
_ensure_encryption_key()
settings = Settings()
