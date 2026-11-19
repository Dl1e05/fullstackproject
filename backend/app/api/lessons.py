from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import OptionalUser
from app.db import get_db
from app.models.course import Course, Lesson
from app.models.exercise import Exercise
from app.models.user import User
from app.schemas.exercise import ExerciseRead
from app.schemas.lesson import LessonRead

router = APIRouter(prefix="/courses/{course_id}", tags=["lessons"])


def _has_access(course: Course, user: User | None) -> bool:
    return course.price == 0 or (
        user is not None and any(p.course_id == course.id for p in user.purchases)
    )


@router.get(
    "/lessons/{lesson_id}",
    response_model=LessonRead,
    summary="Урок",
    responses={404: {"description": "Урок не найден"}},
)
def get_lesson(
    course_id: str, lesson_id: str, db: Annotated[Session, Depends(get_db)], user: OptionalUser
) -> LessonRead:
    course = db.get(Course, course_id)
    lessons = list(
        db.scalars(select(Lesson).where(Lesson.course_id == course_id).order_by(Lesson.order))
    )
    index = next((i for i, lesson in enumerate(lessons) if lesson.id == lesson_id), None)
    if course is None or index is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Урок не найден")

    lesson = lessons[index]
    locked = not _has_access(course, user) and lesson.order != 1
    data = {
        "id": lesson.id,
        "course_id": course_id,
        "order": lesson.order,
        "title": lesson.title,
        "type": lesson.type,
        "minutes": lesson.minutes,
        "index": index,
        "total": len(lessons),
        "prev_id": lessons[index - 1].id if index > 0 else None,
        "next_id": lessons[index + 1].id if index + 1 < len(lessons) else None,
        "locked": locked,
    }
    if locked:
        return LessonRead(**data)

    practice = db.scalar(
        select(Exercise).where(Exercise.kind == "practice", Exercise.lesson_id == lesson_id)
    )
    return LessonRead(
        **data,
        summary=lesson.summary,
        key_points=lesson.key_points,
        practice=ExerciseRead.model_validate(practice) if practice else None,
    )


@router.get(
    "/quiz",
    response_model=list[ExerciseRead],
    summary="Вопросы итогового теста",
    responses={
        402: {"description": "Тест доступен после покупки курса"},
        404: {"description": "Курс не найден"},
    },
)
def get_quiz(
    course_id: str, db: Annotated[Session, Depends(get_db)], user: OptionalUser
) -> list[Exercise]:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Курс не найден")
    if not _has_access(course, user):
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "Тест доступен после покупки курса")
    return list(
        db.scalars(
            select(Exercise)
            .where(Exercise.kind == "quiz", Exercise.course_id == course_id)
            .order_by(Exercise.order)
        )
    )
