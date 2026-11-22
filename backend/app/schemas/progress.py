from uuid import UUID

from pydantic import BaseModel, Field


class LastLessonRead(BaseModel):
    lesson_id: str = Field(serialization_alias="lessonId")
    at: int


class QuizProgressRead(BaseModel):
    score: int
    total: int
    passed: bool
    date: int


class ProgressRead(BaseModel):
    completed: dict[str, list[str]]
    saved: list[str]
    last: dict[str, LastLessonRead]
    quiz: dict[str, QuizProgressRead]


class ProgressStatsRead(BaseModel):
    lessons_done: int = Field(serialization_alias="lessonsDone")
    courses_done: int = Field(serialization_alias="coursesDone")
    saved: int


class QuizAnswer(BaseModel):
    exercise_id: str = Field(
        validation_alias="exerciseId",
        serialization_alias="exerciseId",
        min_length=1,
        max_length=80,
    )
    option_id: str = Field(
        validation_alias="optionId",
        serialization_alias="optionId",
        min_length=1,
        max_length=10,
    )


class QuizAttemptCreate(BaseModel):
    answers: list[QuizAnswer] = Field(max_length=100)
    client_attempt_id: UUID | None = Field(default=None, validation_alias="clientAttemptId")


class QuizAttemptRead(BaseModel):
    id: int | None
    score: int
    total: int
    passed: bool
    date: int


class QuizAttemptListRead(BaseModel):
    items: list[QuizAttemptRead]
    total: int
    limit: int
    offset: int
