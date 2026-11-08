# Шаг — платформа коротких онлайн-курсов

Монорепозиторий:

| Папка | Что внутри |
| --- | --- |
| [`frontend/`](frontend/README.md) | React 18 + Vite PWA |
| [`backend/`](backend/README.md) | FastAPI + SQLAlchemy + PostgreSQL |

## Быстрый старт

```bash
# frontend
cd frontend && npm i && npm run dev        # http://localhost:5173

# backend
cd backend
cp .env.example .env
docker compose up -d db                    # PostgreSQL
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py             # http://localhost:8000/docs
```

## Деплой frontend

Vercel: Root Directory = `frontend`.
