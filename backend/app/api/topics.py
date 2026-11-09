from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.course import Topic
from app.schemas.topic import TopicRead

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=list[TopicRead], summary="Темы курсов")
def list_topics(db: Annotated[Session, Depends(get_db)]) -> list[Topic]:
    return list(db.scalars(select(Topic).order_by(Topic.title, Topic.id)))
