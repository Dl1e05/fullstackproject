from pydantic import BaseModel, Field

from app.schemas.exercise import ExerciseRead


class LessonRead(BaseModel):
    id: str
    course_id: str = Field(serialization_alias="courseId")
    order: int
    title: str
    type: str
    minutes: int
    index: int
    total: int
    prev_id: str | None = Field(serialization_alias="prevId")
    next_id: str | None = Field(serialization_alias="nextId")
    locked: bool
    # у закрытого урока содержимого нет
    summary: list[str] | None = None
    key_points: list[str] | None = Field(default=None, serialization_alias="keyPoints")
    practice: ExerciseRead | None = None
