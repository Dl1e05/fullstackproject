from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.access import has_course_access, has_lesson_access
from app.api.deps import OptionalUser
from app.db import get_db
from app.models.course import Course, Lesson
from app.models.exercise import Exercise
from app.schemas.exercise import AttemptCreate, AttemptRead

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.post(
    "/{exercise_id}/attempts",
    response_model=AttemptRead,
    summary="Проверить ответ на задание",
    responses={
        402: {"description": "Задание доступно после покупки курса"},
        404: {"description": "Задание не найдено"},
    },
)
def submit_attempt(
    exercise_id: str,
    body: AttemptCreate,
    db: Annotated[Session, Depends(get_db)],
    user: OptionalUser,
) -> AttemptRead:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Задание не найдено")
    if exercise.kind == "practice" and exercise.lesson_id is not None:
        lesson = db.get(Lesson, exercise.lesson_id)
        course = db.get(Course, lesson.course_id) if lesson is not None else None
        if lesson is None or course is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Задание не найдено")
        if not has_lesson_access(course, lesson, user):
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                "Задание доступно после покупки курса",
            )
    elif exercise.kind == "quiz" and exercise.course_id is not None:
        course = db.get(Course, exercise.course_id)
        if course is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Задание не найдено")
        if not has_course_access(course, user):
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                "Тест доступен после покупки курса",
            )
    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Задание не найдено")
    option_ids = {option.get("id") for option in exercise.options if isinstance(option, dict)}
    if body.option_id not in option_ids:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Выбранный вариант ответа недоступен",
        )
    return AttemptRead(
        correct=exercise.correct_id == body.option_id,
        correct_id=exercise.correct_id,
        explanation=exercise.explanation,
    )
