from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Все значения берутся из .env (шаблон — .env.example), дефолтов в коде нет."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str
    database_url: str
    cors_origins: list[str]
    secret_key: str
    access_token_expire_minutes: int


@lru_cache
def get_settings() -> Settings:
    return Settings()
