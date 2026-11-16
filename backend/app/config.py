from functools import lru_cache
from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "change-me"


class Settings(BaseSettings):
    """Все значения берутся из .env (шаблон — .env.example), дефолтов в коде нет."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    app_env: str
    database_url: str
    cors_origins: list[str]
    secret_key: str
    access_token_expire_minutes: int

    @model_validator(mode="after")
    def _forbid_default_secret_outside_dev(self) -> Self:
        if self.app_env != "dev" and self.secret_key == DEFAULT_SECRET_KEY:
            raise ValueError("SECRET_KEY must be set when APP_ENV is not 'dev'")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
