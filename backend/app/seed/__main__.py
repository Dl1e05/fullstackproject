"""Заполняет БД демо-данными из data.json (из frontend/src/data); запуск можно повторять.

uv run python -m app.seed
"""

import json
from pathlib import Path

from app.db import SessionLocal
from app.models import Course, Exercise, Lesson, Topic

DATA = Path(__file__).with_name("data.json")


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    with SessionLocal() as db:
        # порядок важен из-за внешних ключей
        for model, rows in (
            (Topic, data["topics"]),
            (Course, data["courses"]),
            (Lesson, data["lessons"]),
            (Exercise, data["exercises"]),
        ):
            for row in rows:
                db.merge(model(**row))
        db.commit()
    print({key: len(rows) for key, rows in data.items()})


if __name__ == "__main__":
    main()
