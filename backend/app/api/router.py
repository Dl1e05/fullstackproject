from fastapi import APIRouter

from app.api import auth, courses, exercises, health, lessons, topics, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(topics.router)
api_router.include_router(courses.router)
api_router.include_router(lessons.router)
api_router.include_router(exercises.router)
