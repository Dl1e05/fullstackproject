from app.models.course import Course, Lesson
from app.models.user import User


def has_course_access(course: Course, user: User | None) -> bool:
    return course.price == 0 or (
        user is not None and any(purchase.course_id == course.id for purchase in user.purchases)
    )


def has_lesson_access(course: Course, lesson: Lesson, user: User | None) -> bool:
    if lesson.course_id != course.id:
        return False
    return has_course_access(course, user) or lesson.order == 1
