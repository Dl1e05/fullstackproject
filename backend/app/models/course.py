from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(7))
    icon: Mapped[str] = mapped_column(String(30))


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[str] = mapped_column(String(300))
    level: Mapped[str] = mapped_column(String(30))
    price: Mapped[int] = mapped_column(Integer, default=0)  # USD, 0 — бесплатно
    popular: Mapped[bool] = mapped_column(default=False)
    description: Mapped[str] = mapped_column(Text)
    outcomes: Mapped[list[str]] = mapped_column(JSONB, default=list)

    topic: Mapped[Topic] = relationship()
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="course", order_by="Lesson.order", cascade="all, delete-orphan"
    )


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    order: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(10))  # 'text' | 'video'
    minutes: Mapped[int] = mapped_column(Integer)
    summary: Mapped[list[str]] = mapped_column(JSONB, default=list)
    key_points: Mapped[list[str]] = mapped_column(JSONB, default=list)

    course: Mapped[Course] = relationship(back_populates="lessons")
