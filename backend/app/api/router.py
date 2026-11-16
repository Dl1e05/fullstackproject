from fastapi import APIRouter

from app.api import auth, courses, health, topics, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(topics.router)
api_router.include_router(courses.router)
