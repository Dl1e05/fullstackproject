from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Exercise(Base):
    """practice — задание к уроку (lesson_id), quiz — вопрос итогового теста (course_id)."""

    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    lesson_id: Mapped[str | None] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[str | None] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    order: Mapped[int | None] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    options: Mapped[list[dict]] = mapped_column(JSONB)  # [{"id": "a", "text": "..."}]
    correct_id: Mapped[str] = mapped_column(String(10))
    explanation: Mapped[str] = mapped_column(Text)
