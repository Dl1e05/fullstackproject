import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import UNAUTHORIZED_RESPONSE, bearer, get_current_user
from app.db import get_db
from app.models.auth import PasswordResetToken, RevokedToken
from app.models.user import User
from app.schemas.user import (
    ForgotPasswordRequest,
    PasswordResetRequest,
    TokenRead,
    UserLogin,
    UserRead,
    UserRegister,
)
from app.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    decode_access_token,
    hash_access_token,
    hash_password,
    verify_password,
)
from app.services.email import EmailSender, get_email_sender

router = APIRouter(prefix="/auth", tags=["auth"])


def _email_taken() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Пользователь с такой почтой уже зарегистрирован",
    )


def _token_response(user: User) -> TokenRead:
    return TokenRead(
        access_token=create_access_token(user.id, user.token_version),
        user=UserRead.from_user(user),
    )


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
    responses=UNAUTHORIZED_RESPONSE,
)
def revoke_current_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен",
        )
    token = credentials.credentials
    claims = decode_access_token(token)
    if claims is None or claims.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен",
        )
    db.execute(
        pg_insert(RevokedToken)
        .values(token_hash=hash_access_token(token), expires_at=claims.expires_at)
        .on_conflict_do_nothing(index_elements=[RevokedToken.token_hash])
    )
    db.commit()
    return None


@router.post(
    "/forgot-password",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Запросить сброс пароля",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
    email_sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> None:
    email = str(payload.email).strip().lower()
    user_id = db.scalar(select(User.id).where(User.email == email).with_for_update())
    if user_id is not None:
        token = secrets.token_urlsafe(32)
        db.add(
            PasswordResetToken(
                token_hash=hash_access_token(token),
                user_id=user_id,
                expires_at=datetime.now(UTC) + timedelta(minutes=30),
            )
        )
        db.commit()
        try:
            email_sender.send_password_reset(email, token)
        except Exception:
            pass
    return None


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Сбросить пароль",
    responses={400: {"description": "Токен недействителен или просрочен"}},
)
def reset_password(
    payload: PasswordResetRequest,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    token_hash = hash_access_token(payload.token)
    now = datetime.now(UTC)
    candidate_user_id = db.scalar(
        select(PasswordResetToken.user_id).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    if candidate_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Токен недействителен или просрочен",
        )
    password_hash = hash_password(payload.password)
    user_id = db.scalar(select(User.id).where(User.id == candidate_user_id).with_for_update())
    if user_id is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Токен недействителен или просрочен",
        )
    now = datetime.now(UTC)
    claimed_user_id = db.scalar(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
        .values(used_at=now)
        .returning(PasswordResetToken.user_id)
    )
    if claimed_user_id is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Токен недействителен или просрочен",
        )
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    db.execute(
        update(User)
        .where(User.id == user_id)
        .values(password_hash=password_hash, token_version=User.token_version + 1)
    )
    db.commit()
    return None
