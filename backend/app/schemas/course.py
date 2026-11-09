from pydantic import BaseModel, Field

from app.schemas.topic import TopicRead


class CourseRead(BaseModel):
    id: str
    topic_id: str = Field(serialization_alias="topicId")
    title: str
    subtitle: str
    level: str
    price: int
    popular: bool
    description: str
    outcomes: list[str]
    topic: TopicRead
    lessons_count: int = Field(serialization_alias="lessonsCount")
    minutes: int
    duration: str
    has_access: bool = Field(serialization_alias="hasAccess")


class LessonPreview(BaseModel):
    id: str
    order: int
    title: str
    type: str
    minutes: int
    preview: bool
    locked: bool


class CourseDetailRead(CourseRead):
    lessons: list[LessonPreview]
    quiz_count: int = Field(serialization_alias="quizCount")
