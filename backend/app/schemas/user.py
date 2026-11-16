from datetime import datetime
from typing import Annotated, Self

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.models.user import User

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class UserRegister(BaseModel):
    name: Name
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


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
