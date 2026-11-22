import re
from datetime import datetime
from typing import Annotated, Self

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints

from app.models.user import User


def _validate_password_strength(password: str) -> str:
    if re.search(r"\s", password):
        raise ValueError("Пароль не должен содержать пробелов")
    if re.search(r"[а-яё]", password, re.IGNORECASE):
        raise ValueError("Пароль вводится латинскими буквами")
    if not re.search(r"[a-z]", password, re.IGNORECASE):
        raise ValueError("Добавьте в пароль хотя бы одну латинскую букву")
    if not re.search(r"[0-9]", password):
        raise ValueError("Добавьте в пароль хотя бы одну цифру")
    if re.fullmatch(r"(.)\1+", password) or password.lower() in {
        "12345678",
        "qwerty123",
        "password1",
        "11111111",
    }:
        raise ValueError("Пароль слишком простой")
    return password


Name = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=2,
        max_length=40,
        pattern=r"^[A-Za-zА-Яа-яЁё\s'-]+$",
    ),
]
Password = Annotated[
    str,
    StringConstraints(min_length=8, max_length=128),
    AfterValidator(_validate_password_strength),
]


class UserRegister(BaseModel):
    name: Name
    email: EmailStr
    password: Password


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: Password


class UserUpdate(BaseModel):
    name: Name


class UserRead(BaseModel):
    id: int
    name: str
    email: str
    purchases: list[str]
    created_at: datetime = Field(serialization_alias="createdAt")

    @classmethod
    def from_user(cls, user: User) -> Self:
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            purchases=[purchase.course_id for purchase in user.purchases],
            created_at=user.created_at,
        )


class TokenRead(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    token_type: str = Field(default="bearer", serialization_alias="tokenType")
    user: UserRead
