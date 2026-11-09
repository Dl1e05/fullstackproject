from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models.course import Course, Lesson
from app.models.exercise import Exercise
from app.schemas.course import CourseDetailRead, CourseRead, LessonPreview
from app.schemas.topic import TopicRead

router = APIRouter(prefix="/courses", tags=["courses"])


def _course_query() -> Select[tuple[Course, int, int]]:
    stats = (
        select(
            Lesson.course_id,
            func.count(Lesson.id).label("lessons_count"),
            func.sum(Lesson.minutes).label("minutes"),
        )
        .group_by(Lesson.course_id)
        .subquery()
    )
    return (
        select(
            Course,
            func.coalesce(stats.c.lessons_count, 0),
            func.coalesce(stats.c.minutes, 0),
        )
        .outerjoin(stats, stats.c.course_id == Course.id)
        .options(joinedload(Course.topic))
    )


def _format_minutes(total: int) -> str:
    if total < 60:
        return f"{total} мин"
    hours, minutes = divmod(total, 60)
    return f"{hours} ч {minutes} мин" if minutes else f"{hours} ч"


def _serialize_course(course: Course, lessons_count: int, minutes: int) -> CourseRead:
    return CourseRead(
        id=course.id,
        topic_id=course.topic_id,
        title=course.title,
        subtitle=course.subtitle,
        level=course.level,
        price=course.price,
        popular=course.popular,
        description=course.description,
        outcomes=course.outcomes,
        topic=TopicRead.model_validate(course.topic),
        lessons_count=lessons_count,
        minutes=minutes,
        duration=_format_minutes(minutes),
        has_access=course.price == 0,
    )


@router.get("", response_model=list[CourseRead], summary="Список курсов")
def list_courses(
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str, Query(description="Поиск по названию, подзаголовку и названиям уроков")] = "",
    topic: Annotated[str, Query(description="Идентификатор темы")] = "",
    price: Annotated[Literal["", "free", "paid"], Query(description="Фильтр по стоимости")] = "",
    popular: Annotated[bool | None, Query(description="Фильтр популярных курсов")] = None,
) -> list[CourseRead]:
    statement = _course_query().order_by(Course.title, Course.id)
    if query := q.strip():
        statement = statement.where(
            or_(
                Course.title.icontains(query, autoescape=True),
                Course.subtitle.icontains(query, autoescape=True),
                Course.lessons.any(Lesson.title.icontains(query, autoescape=True)),
            )
        )
    if topic:
        statement = statement.where(Course.topic_id == topic)
    if price == "free":
        statement = statement.where(Course.price == 0)
    elif price == "paid":
        statement = statement.where(Course.price > 0)
    if popular is not None:
        statement = statement.where(Course.popular == popular)

    return [
        _serialize_course(course, lessons_count, minutes)
        for course, lessons_count, minutes in db.execute(statement)
    ]


@router.get(
    "/{course_id}",
    response_model=CourseDetailRead,
    summary="Описание и программа курса",
    responses={404: {"description": "Курс не найден"}},
)
def get_course(course_id: str, db: Annotated[Session, Depends(get_db)]) -> CourseDetailRead:
    row = db.execute(_course_query().where(Course.id == course_id)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    course, lessons_count, minutes = row
    data = _serialize_course(course, lessons_count, minutes)
    lessons = db.execute(
        select(Lesson.id, Lesson.order, Lesson.title, Lesson.type, Lesson.minutes)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.order, Lesson.id)
    ).mappings()
    quiz_count = db.scalar(
        select(func.count(Exercise.id)).where(
            Exercise.course_id == course_id, Exercise.kind == "quiz"
        )
    )

    return CourseDetailRead(
        **data.model_dump(),
        lessons=[
            LessonPreview(
                **lesson,
                preview=course.price > 0 and lesson["order"] == 1,
                locked=not data.has_access and lesson["order"] != 1,
            )
            for lesson in lessons
        ],
        quiz_count=quiz_count or 0,
    )
