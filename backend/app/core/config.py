from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AI Asset Intelligence Platform"
    environment: str = "development"
    database_url: str = "sqlite:///./demo.db"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000"]
    demo_asset_count: int = 100
    demo_history_days: int = 45
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
