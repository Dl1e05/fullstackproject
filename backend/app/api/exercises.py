from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.exercise import Exercise
from app.schemas.exercise import AttemptCreate, AttemptRead

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.post(
    "/{exercise_id}/attempts",
    response_model=AttemptRead,
    summary="Проверить ответ на задание",
    responses={404: {"description": "Задание не найдено"}},
)
def submit_attempt(
    exercise_id: str, body: AttemptCreate, db: Annotated[Session, Depends(get_db)]
) -> AttemptRead:
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Задание не найдено")
    return AttemptRead(
        correct=exercise.correct_id == body.option_id,
        correct_id=exercise.correct_id,
        explanation=exercise.explanation,
    )
