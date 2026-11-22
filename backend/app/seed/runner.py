from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import get_settings
from app.seed.demo_data import DEMO_ACCOUNTS, DEMO_PASSWORD

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.user import User


def _insert_missing(session: Session, model: type, rows: list[dict[str, Any]]) -> None:
    if rows:
        session.execute(pg_insert(model).values(rows).on_conflict_do_nothing())


def _seed_content(session: Session, data: dict[str, Any]) -> None:
    from app.models import Course, Exercise, Lesson, Topic

    for model, key in (
        (Topic, "topics"),
        (Course, "courses"),
        (Lesson, "lessons"),
        (Exercise, "exercises"),
    ):
        _insert_missing(session, model, data[key])


def _demo_user(session: Session, account: dict[str, Any]) -> User | None:
    from app.models import User
    from app.security import hash_password, verify_password

    session.execute(
        pg_insert(User)
        .values(
            email=account["email"],
            name=account["name"],
            password_hash=hash_password(DEMO_PASSWORD),
        )
        .on_conflict_do_nothing(index_elements=[User.email])
    )
    user = session.scalar(select(User).where(User.email == account["email"]).with_for_update())
    if user is None or user.name != account["name"]:
        return None
    try:
        if not verify_password(DEMO_PASSWORD, user.password_hash):
            return None
    except Exception:
        return None
    return user


def _seed_demo_account(
    session: Session,
    account: dict[str, Any],
    data: dict[str, Any],
) -> bool:
    from app.models import CourseProgress, LessonCompletion, Purchase, QuizAttempt

    user = _demo_user(session, account)
    if user is None:
        return False

    now = datetime.now(UTC)
    _insert_missing(
        session,
        Purchase,
        [{"user_id": user.id, "course_id": course_id} for course_id in account["purchases"]],
    )
    _insert_missing(
        session,
        CourseProgress,
        [
            {
                "user_id": user.id,
                "course_id": progress["course_id"],
                "saved": progress["saved"],
                "last_lesson_id": progress["last_lesson_id"],
                "last_lesson_at": now if progress["last_lesson_id"] else None,
            }
            for progress in account["progress"]
        ],
    )
    _insert_missing(
        session,
        LessonCompletion,
        [{"user_id": user.id, "lesson_id": lesson_id} for lesson_id in account["completed"]],
    )

    quiz_totals: dict[str, int] = {}
    for exercise in data["exercises"]:
        if exercise["kind"] == "quiz":
            course_id = exercise["course_id"]
            quiz_totals[course_id] = quiz_totals.get(course_id, 0) + 1
    for quiz in account["quizzes"]:
        course_id = quiz["course_id"]
        total = quiz_totals[course_id]
        if (
            session.scalar(
                select(QuizAttempt.id)
                .where(QuizAttempt.user_id == user.id, QuizAttempt.course_id == course_id)
                .limit(1)
            )
            is None
        ):
            session.add(
                QuizAttempt(
                    user_id=user.id,
                    course_id=course_id,
                    score=quiz["score"],
                    total=total,
                    passed=quiz["score"] * 100 >= total * 70,
                    created_at=now,
                )
            )
    return True


def seed(data: dict[str, Any], *, include_demo: bool) -> dict[str, Any]:
    if get_settings().app_env != "dev":
        raise RuntimeError("Seeding is allowed only when APP_ENV=dev")
    from app.db import SessionLocal

    summary: dict[str, Any] = {
        "content_rows": {key: len(rows) for key, rows in data.items()},
        "demo_enabled": include_demo,
    }
    with SessionLocal() as session:
        try:
            _seed_content(session, data)
            if include_demo:
                seeded = sum(
                    _seed_demo_account(session, account, data) for account in DEMO_ACCOUNTS
                )
                summary["demo_accounts_seeded"] = seeded
                summary["demo_accounts_skipped"] = len(DEMO_ACCOUNTS) - seeded
            session.commit()
        except Exception:
            session.rollback()
            raise
    return summary
