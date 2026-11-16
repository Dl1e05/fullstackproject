from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import UNAUTHORIZED_RESPONSE, get_current_user
from app.db import get_db
from app.models.user import User
from app.schemas.user import TokenRead, UserLogin, UserRead, UserRegister
from app.security import DUMMY_PASSWORD_HASH, create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _email_taken() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Пользователь с такой почтой уже зарегистрирован",
    )


def _token_response(user: User) -> TokenRead:
    return TokenRead(access_token=create_access_token(user.id), user=UserRead.from_user(user))


@router.post(
    "/register",
    response_model=TokenRead,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация",
    responses={409: {"description": "Пользователь с такой почтой уже зарегистрирован"}},
)
def register(payload: UserRegister, db: Annotated[Session, Depends(get_db)]) -> TokenRead:
    email = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise _email_taken()

    user = User(
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        purchases=[],
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _email_taken() from None
    return _token_response(user)


@router.post(
    "/login",
    response_model=TokenRead,
    summary="Вход",
    responses={401: {"description": "Неверная почта или пароль"}},
)
def login(payload: UserLogin, db: Annotated[Session, Depends(get_db)]) -> TokenRead:
    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email).options(selectinload(User.purchases)))
    password_ok = verify_password(
        payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH
    )
    if user is None or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверная почта или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _token_response(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Выход",
    dependencies=[Depends(get_current_user)],
    responses=UNAUTHORIZED_RESPONSE,
)
def logout() -> None:
    # JWT stateless: отзывать нечего, клиент просто удаляет токен
    return None
