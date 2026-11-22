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
    def _validate_security_settings(self) -> Self:
        if self.access_token_expire_minutes <= 0:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be positive")
        if not self.secret_key.strip():
            raise ValueError("SECRET_KEY must not be empty")
        if self.app_env != "dev" and (
            self.secret_key == DEFAULT_SECRET_KEY or len(self.secret_key.strip()) < 32
        ):
            raise ValueError("SECRET_KEY must be at least 32 characters outside dev")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
