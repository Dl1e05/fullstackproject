from fastapi import APIRouter

from app.api import courses, health, topics

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(topics.router)
api_router.include_router(courses.router)
