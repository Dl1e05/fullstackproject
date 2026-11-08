# Шаг — backend

FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL. Зависимости — через [uv](https://docs.astral.sh/uv/).

```bash
cp .env.example .env
docker compose up -d db
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py      # http://localhost:8000/docs
uv run pytest
uv run ruff check . && uv run ruff format .
```

## Структура

```
app/
  main.py      приложение, CORS
  config.py    настройки из .env
  db.py        engine, сессия, Base
  models/      ORM-модели
  api/         роутеры
alembic/       миграции
```

Контракт API описан в комментарии в начале `frontend/src/services/api.js`.
