from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class AnswerOption(BaseModel):
    id: str
    text: str


class ExerciseRead(BaseModel):
    """Вопрос без правильного ответа."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    lesson_id: str | None = Field(default=None, serialization_alias="lessonId")
    course_id: str | None = Field(default=None, serialization_alias="courseId")
    order: int | None = None
    question: str
    options: list[AnswerOption]


class AttemptCreate(BaseModel):
    option_id: Annotated[str, StringConstraints(min_length=1, max_length=10)] = Field(
        validation_alias="optionId"
    )


class AttemptRead(BaseModel):
    correct: bool
    correct_id: str = Field(serialization_alias="correctId")
    explanation: str
