"""Тесты идут на отдельной PostgreSQL (модели используют JSONB): задайте TEST_DATABASE_URL,
имя базы должно заканчиваться на `_test`. Без неё тесты, которым нужна БД, пропускаются.

    TEST_DATABASE_URL=postgresql+psycopg://shag:shag@localhost:5544/shag_test uv run pytest
"""

import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")

# Настройки подставляются до импорта приложения и перекрывают .env, чтобы тесты
# никогда не трогали рабочую базу.
os.environ.update(
    APP_ENV="dev",
    DATABASE_URL=TEST_DB_URL or "postgresql+psycopg://x:x@localhost:1/none_test",
    CORS_ORIGINS='["http://localhost:5173"]',
    SECRET_KEY="test-secret-key-test-secret-key-0123456789",
    ACCESS_TOKEN_EXPIRE_MINUTES="60",
)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402

FREE_COURSE = "security"  # бесплатный, уроки sec-1..sec-3
PAID_COURSE = "ai"  # платный, первый урок ai-1 — пробный
PASSWORD = "StrongPass123"


@pytest.fixture(scope="session")
def _database() -> Iterator[None]:
    if not TEST_DB_URL:
        pytest.skip("TEST_DATABASE_URL не задан")
    if not engine.url.database.endswith("_test"):
        pytest.exit("Имя тестовой базы должно заканчиваться на _test", returncode=2)

    from alembic.config import Config

    from alembic import command

    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    cfg = Config(str(ROOT / "alembic.ini"))
    command.upgrade(cfg, "head")  # заодно проверяет, что миграции собирают схему

    from app.seed.runner import seed

    seed(json.loads((ROOT / "app/seed/data.json").read_text(encoding="utf-8")), include_demo=False)
    yield
    engine.dispose()


@pytest.fixture
def client(_database: None) -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as c:
        yield c
    # контент (курсы, уроки) остаётся, всё пользовательское очищается
    with SessionLocal() as db:
        db.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))
        db.commit()


def register(client: TestClient, email: str = "user@example.com", name: str = "Иван") -> dict:
    r = client.post("/auth/register", json={"name": name, "email": email, "password": PASSWORD})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def auth(client: TestClient) -> dict[str, str]:
    """Заголовки зарегистрированного пользователя."""
    return {"Authorization": f"Bearer {register(client)['accessToken']}"}
