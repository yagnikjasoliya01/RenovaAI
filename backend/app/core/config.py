from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "RenovaAI API"
    # Supabase PostgreSQL only (no default SQLite)
    database_url: str
    gemini_api_key: str = ""
    openai_api_key: str = ""
    upload_dir: str = "uploads"
    
    # Supabase authentication & storage
    supabase_url: str
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    jwt_secret: str = ""
    
    # CORS configuration - set this in production to your domain
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
