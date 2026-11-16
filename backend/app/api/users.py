from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import UNAUTHORIZED_RESPONSE, CurrentUser
from app.db import get_db
from app.schemas.user import UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=UserRead,
    summary="Текущий пользователь",
    responses=UNAUTHORIZED_RESPONSE,
)
def get_me(user: CurrentUser) -> UserRead:
    return UserRead.from_user(user)


@router.patch(
    "/me",
    response_model=UserRead,
    summary="Обновить профиль",
    responses=UNAUTHORIZED_RESPONSE,
)
def update_me(
    payload: UserUpdate, user: CurrentUser, db: Annotated[Session, Depends(get_db)]
) -> UserRead:
    user.name = payload.name
    db.commit()
    return UserRead.from_user(user)
