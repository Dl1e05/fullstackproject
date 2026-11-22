# Шаг — платформа коротких онлайн-курсов

Монорепозиторий:

| Папка | Что внутри |
| --- | --- |
| [`frontend/`](frontend/README.md) | React 18 + Vite PWA |
| [`backend/`](backend/README.md) | FastAPI + SQLAlchemy + PostgreSQL |

## Быстрый старт

Весь проект в Docker одной командой:

```bash
docker compose up --build
```

- frontend — http://localhost:5173
- backend — http://localhost:8000/docs
- демо-аккаунты: `demo@example.com` и `demo.paid@example.com`, пароль `DemoPass123`

Миграции и демо-данные применяются автоматически при старте. Остановить: `docker compose down` (добавь `-v`, чтобы удалить и базу).

### Без Docker для приложений (режим разработки)

В Docker остаётся только БД, backend и frontend запускаются с горячей перезагрузкой:

```bash
# backend
cd backend
cp .env.example .env                       # SECRET_KEY: python -c "import secrets; print(secrets.token_urlsafe(32))"
docker compose up -d db                    # PostgreSQL на порту 5544
uv sync
uv run alembic upgrade head
uv run python -m app.seed --demo           # курсы и демо-аккаунты (только APP_ENV=dev)
uv run fastapi dev app/main.py             # http://localhost:8000/docs

# frontend
cd frontend && cp .env.example .env.local && npm i && npm run dev   # http://localhost:5173
```

## API

Интерактивная документация — `/docs` у запущенного backend. Основные группы:

| Группа | Маршруты |
| --- | --- |
| Контент | `GET /topics`, `GET /courses`, `GET /courses/{id}`, `GET /courses/{id}/lessons/{lessonId}`, `GET /courses/{id}/quiz` |
| Аккаунт | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET/PATCH /users/me` |
| Покупки | `POST /courses/{id}/purchase` (демо-оплата) |
| Прогресс | `GET /users/me/progress`, `/users/me/stats`, `PUT …/completion`, `PUT …/visit`, `PUT/DELETE /users/me/saved/{id}` |
| Задания | `POST /exercises/{id}/attempts`, `POST/GET /courses/{id}/quiz/attempts` |

Подробности по прогрессу и безопасности — в [`backend/README.md`](backend/README.md).

## Тесты

```bash
cd backend
TEST_DATABASE_URL=postgresql+psycopg://shag:shag@localhost:5544/shag_test uv run pytest
```

Тестовая база должна называться `*_test`: перед прогоном схема в ней пересоздаётся миграциями.

## Деплой

- **Frontend** — Vercel, Root Directory = `frontend`, переменная `VITE_API_URL` с адресом backend.
- **Backend** — `backend/Dockerfile` (миграции применяются при старте). Переменные окружения те же, что в `backend/.env.example`; вне dev `SECRET_KEY` — не короче 32 символов, `CORS_ORIGINS` — адрес frontend, `APP_ENV` — не `dev`.
- Для восстановления пароля и оплаты сейчас работают mock-адаптеры: на проде нужны почтовый и платёжный провайдеры.
