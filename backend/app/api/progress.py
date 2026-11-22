import json
from collections import defaultdict
from datetime import UTC, datetime
from hashlib import sha256
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy import Numeric, cast, delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.access import has_course_access, has_lesson_access
from app.api.deps import UNAUTHORIZED_RESPONSE, CurrentUser, OptionalUser
from app.db import get_db
from app.models.course import Course, Lesson
from app.models.exercise import Exercise
from app.models.progress import CourseProgress, LessonCompletion, QuizAttempt
from app.models.user import User
from app.schemas.progress import (
    LastLessonRead,
    ProgressRead,
    ProgressStatsRead,
    QuizAttemptCreate,
    QuizAttemptListRead,
    QuizAttemptRead,
    QuizProgressRead,
)

router = APIRouter(tags=["progress"])

PASS_THRESHOLD_PERCENT = 70
CourseId = Annotated[str, Path(min_length=1, max_length=50)]
LessonId = Annotated[str, Path(min_length=1, max_length=50)]


def _epoch_ms(value: datetime) -> int:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return int(value.timestamp() * 1000)


def _lock_user(db: Session, user_id: int) -> None:
    db.scalar(select(User.id).where(User.id == user_id).with_for_update())


def _accessible_lesson(
    course_id: str, lesson_id: str, db: Session, user: CurrentUser
) -> tuple[Course, Lesson]:
    row = db.execute(
        select(Course, Lesson)
        .join(Lesson, Lesson.course_id == Course.id)
        .where(Course.id == course_id, Lesson.id == lesson_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Урок не найден")

    course, lesson = row
    if not has_lesson_access(course, lesson, user):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Урок доступен после покупки курса",
        )
    return course, lesson


def _quiz_attempt_read(attempt: QuizAttempt) -> QuizAttemptRead:
    return QuizAttemptRead(
        id=attempt.id,
        score=attempt.score,
        total=attempt.total,
        passed=attempt.passed,
        date=_epoch_ms(attempt.created_at),
    )


def _quiz_request_hash(payload: QuizAttemptCreate) -> str:
    pairs = sorted([[answer.exercise_id, answer.option_id] for answer in payload.answers])
    encoded = json.dumps(pairs, separators=(",", ":"))
    return sha256(encoded.encode("utf-8")).hexdigest()


@router.get(
    "/users/me/progress",
    response_model=ProgressRead,
    summary="Прогресс пользователя",
    responses=UNAUTHORIZED_RESPONSE,
)
def get_progress(user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> ProgressRead:
    completed: dict[str, list[str]] = defaultdict(list)
    completion_rows = db.execute(
        select(Lesson.course_id, LessonCompletion.lesson_id)
        .join(Lesson, Lesson.id == LessonCompletion.lesson_id)
        .where(LessonCompletion.user_id == user.id)
        .order_by(Lesson.course_id, Lesson.order, Lesson.id)
    )
    for course_id, lesson_id in completion_rows:
        completed[course_id].append(lesson_id)

    saved: list[str] = []
    last: dict[str, LastLessonRead] = {}
    course_rows = db.scalars(
        select(CourseProgress)
        .where(CourseProgress.user_id == user.id)
        .order_by(CourseProgress.course_id)
    )
    for course_progress in course_rows:
        if course_progress.saved:
            saved.append(course_progress.course_id)
        if course_progress.last_lesson_id and course_progress.last_lesson_at:
            last[course_progress.course_id] = LastLessonRead(
                lesson_id=course_progress.last_lesson_id,
                at=_epoch_ms(course_progress.last_lesson_at),
            )

    quiz_rows = (
        select(
            QuizAttempt.course_id,
            QuizAttempt.score,
            QuizAttempt.total,
            QuizAttempt.created_at,
            func.bool_or(QuizAttempt.passed)
            .over(partition_by=QuizAttempt.course_id)
            .label("passed"),
            func.row_number()
            .over(
                partition_by=QuizAttempt.course_id,
                order_by=(
                    (cast(QuizAttempt.score, Numeric) / QuizAttempt.total).desc(),
                    QuizAttempt.created_at.desc(),
                    QuizAttempt.id.desc(),
                ),
            )
            .label("rank"),
        )
        .where(QuizAttempt.user_id == user.id)
        .subquery()
    )
    quiz = {
        course_id: QuizProgressRead(
            score=score,
            total=total,
            passed=passed,
            date=_epoch_ms(created_at),
        )
        for course_id, score, total, created_at, passed in db.execute(
            select(
                quiz_rows.c.course_id,
                quiz_rows.c.score,
                quiz_rows.c.total,
                quiz_rows.c.created_at,
                quiz_rows.c.passed,
            ).where(quiz_rows.c.rank == 1)
        )
    }

    return ProgressRead(completed=dict(completed), saved=saved, last=last, quiz=quiz)


@router.get(
    "/users/me/stats",
    response_model=ProgressStatsRead,
    summary="Статистика обучения",
    responses=UNAUTHORIZED_RESPONSE,
)
def get_stats(user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> ProgressStatsRead:
    lessons_done = db.scalar(
        select(func.count())
        .select_from(LessonCompletion)
        .where(LessonCompletion.user_id == user.id)
    )
    courses_done = db.scalar(
        select(func.count(func.distinct(QuizAttempt.course_id))).where(
            QuizAttempt.user_id == user.id,
            QuizAttempt.passed.is_(True),
        )
    )
    saved = db.scalar(
        select(func.count())
        .select_from(CourseProgress)
        .where(CourseProgress.user_id == user.id, CourseProgress.saved.is_(True))
    )
    return ProgressStatsRead(
        lessons_done=lessons_done or 0,
        courses_done=courses_done or 0,
        saved=saved or 0,
    )


@router.put(
    "/courses/{course_id}/lessons/{lesson_id}/completion",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Отметить урок завершенным",
    responses={
        **UNAUTHORIZED_RESPONSE,
        402: {"description": "Урок доступен после покупки курса"},
        404: {"description": "Урок не найден"},
    },
)
def complete_lesson(
    course_id: CourseId,
    lesson_id: LessonId,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    _lock_user(db, user.id)
    _accessible_lesson(course_id, lesson_id, db, user)
    statement = (
        pg_insert(LessonCompletion)
        .values(user_id=user.id, lesson_id=lesson_id)
        .on_conflict_do_nothing(
            index_elements=[LessonCompletion.user_id, LessonCompletion.lesson_id]
        )
    )
    db.execute(statement)
    db.commit()
    return None


@router.put(
    "/courses/{course_id}/lessons/{lesson_id}/visit",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Сохранить последний открытый урок",
    responses={
        **UNAUTHORIZED_RESPONSE,
        402: {"description": "Урок доступен после покупки курса"},
        404: {"description": "Урок не найден"},
    },
)
def visit_lesson(
    course_id: CourseId,
    lesson_id: LessonId,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    _lock_user(db, user.id)
    _accessible_lesson(course_id, lesson_id, db, user)
    visited_at = datetime.now(UTC)
    statement = pg_insert(CourseProgress).values(
        user_id=user.id,
        course_id=course_id,
        last_lesson_id=lesson_id,
        last_lesson_at=visited_at,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[CourseProgress.user_id, CourseProgress.course_id],
        set_={"last_lesson_id": lesson_id, "last_lesson_at": visited_at},
    )
    db.execute(statement)
    db.commit()
    return None


@router.put(
    "/users/me/saved/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Добавить курс в избранное",
    responses={**UNAUTHORIZED_RESPONSE, 404: {"description": "Курс не найден"}},
)
def save_course(
    course_id: CourseId, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> None:
    _lock_user(db, user.id)
    if db.get(Course, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")
    statement = pg_insert(CourseProgress).values(user_id=user.id, course_id=course_id, saved=True)
    statement = statement.on_conflict_do_update(
        index_elements=[CourseProgress.user_id, CourseProgress.course_id],
        set_={"saved": True},
    )
    db.execute(statement)
    db.commit()
    return None


@router.delete(
    "/users/me/saved/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Убрать курс из избранного",
    responses={**UNAUTHORIZED_RESPONSE, 404: {"description": "Курс не найден"}},
)
def unsave_course(
    course_id: CourseId, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> None:
    _lock_user(db, user.id)
    if db.get(Course, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")
    db.execute(
        update(CourseProgress)
        .where(CourseProgress.user_id == user.id, CourseProgress.course_id == course_id)
        .values(saved=False)
    )
    db.commit()
    return None


@router.delete(
    "/users/me/progress",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Сбросить прогресс пользователя",
    responses=UNAUTHORIZED_RESPONSE,
)
def reset_progress(user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> None:
    _lock_user(db, user.id)
    db.execute(delete(QuizAttempt).where(QuizAttempt.user_id == user.id))
    db.execute(delete(LessonCompletion).where(LessonCompletion.user_id == user.id))
    db.execute(delete(CourseProgress).where(CourseProgress.user_id == user.id))
    db.commit()
    return None


@router.post(
    "/courses/{course_id}/quiz/attempts",
    response_model=QuizAttemptRead,
    status_code=status.HTTP_201_CREATED,
    summary="Отправить итоговый тест",
    responses={
        200: {
            "model": QuizAttemptRead,
            "description": "Гостевой результат без сохранения или повтор idempotent attempt",
        },
        **UNAUTHORIZED_RESPONSE,
        402: {"description": "Тест доступен после покупки курса"},
        404: {"description": "Курс не найден"},
        409: {"description": "Нет вопросов или clientAttemptId использован с другими ответами"},
        422: {"description": "Ответы не соответствуют вопросам теста"},
    },
)
def submit_quiz_attempt(
    course_id: CourseId,
    payload: QuizAttemptCreate,
    response: Response,
    user: OptionalUser,
    db: Annotated[Session, Depends(get_db)],
) -> QuizAttemptRead:
    if user is not None:
        _lock_user(db, user.id)
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")
    if not has_course_access(course, user):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Тест доступен после покупки курса",
        )

    client_attempt_id = payload.client_attempt_id
    request_hash = (
        _quiz_request_hash(payload) if user is not None and client_attempt_id is not None else None
    )
    if user is not None and client_attempt_id is not None:
        existing_attempt = db.scalar(
            select(QuizAttempt).where(
                QuizAttempt.user_id == user.id,
                QuizAttempt.course_id == course_id,
                QuizAttempt.client_attempt_id == str(client_attempt_id),
            )
        )
        if existing_attempt is not None:
            if existing_attempt.request_hash != request_hash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="clientAttemptId уже использован с другими ответами",
                )
            response.status_code = status.HTTP_200_OK
            return _quiz_attempt_read(existing_attempt)

    questions = list(
        db.scalars(
            select(Exercise)
            .where(Exercise.kind == "quiz", Exercise.course_id == course_id)
            .order_by(Exercise.order, Exercise.id)
        )
    )
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="В курсе нет вопросов итогового теста",
        )

    answers = payload.answers
    answer_ids = [answer.exercise_id for answer in answers]
    questions_by_id = {question.id: question for question in questions}
    if len(answer_ids) != len(set(answer_ids)) or set(answer_ids) != set(questions_by_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Нужно отправить по одному ответу на каждый вопрос теста",
        )

    score = 0
    for answer in answers:
        question = questions_by_id[answer.exercise_id]
        if not any(option.get("id") == answer.option_id for option in question.options):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Вариант ответа не принадлежит вопросу",
            )
        score += question.correct_id == answer.option_id

    total = len(questions)
    passed = score * 100 >= total * PASS_THRESHOLD_PERCENT
    created_at = datetime.now(UTC)
    attempt_id: int | None = None
    if user is not None:
        attempt = QuizAttempt(
            user_id=user.id,
            course_id=course_id,
            score=score,
            total=total,
            passed=passed,
            client_attempt_id=str(client_attempt_id) if client_attempt_id is not None else None,
            request_hash=request_hash,
            created_at=created_at,
        )
        db.add(attempt)
        db.flush()
        attempt_id = attempt.id
        db.commit()
    else:
        response.status_code = status.HTTP_200_OK

    return QuizAttemptRead(
        id=attempt_id,
        score=score,
        total=total,
        passed=passed,
        date=_epoch_ms(created_at),
    )


@router.get(
    "/courses/{course_id}/quiz/attempts",
    response_model=QuizAttemptListRead,
    summary="История итоговых тестов пользователя",
    responses={**UNAUTHORIZED_RESPONSE, 404: {"description": "Курс не найден"}},
)
def get_quiz_attempts(
    course_id: CourseId,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> QuizAttemptListRead:
    if db.get(Course, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")
    filters = (QuizAttempt.user_id == user.id, QuizAttempt.course_id == course_id)
    total = db.scalar(select(func.count()).select_from(QuizAttempt).where(*filters)) or 0
    attempts = db.scalars(
        select(QuizAttempt)
        .where(*filters)
        .order_by(QuizAttempt.created_at.desc(), QuizAttempt.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return QuizAttemptListRead(
        items=[_quiz_attempt_read(attempt) for attempt in attempts],
        total=total,
        limit=limit,
        offset=offset,
    )
