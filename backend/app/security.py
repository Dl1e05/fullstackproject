import base64
import binascii
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.config import get_settings

JWT_ALGORITHM = "HS256"
MAX_USER_ID = 2_147_483_647


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: int
    token_version: int
    expires_at: datetime


_password_hash = PasswordHash((Argon2Hasher(),))

# При неизвестной почте пароль сверяется с этим хешем, чтобы по времени ответа
# нельзя было понять, есть ли аккаунт
DUMMY_PASSWORD_HASH = _password_hash.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def create_access_token(user_id: int, token_version: int = 0) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": expires_at,
        "ver": token_version,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> AccessTokenClaims | None:
    settings = get_settings()
    try:
        if not isinstance(token, str):
            return None
        segments = token.split(".")
        if len(segments) != 3:
            return None
        for segment in segments:
            if not segment or "=" in segment:
                return None
            padded = segment + "=" * (-len(segment) % 4)
            decoded = base64.b64decode(padded, altchars=b"-_", validate=True)
            if base64.urlsafe_b64encode(decoded).decode("ascii").rstrip("=") != segment:
                return None
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        subject = payload["sub"]
        if not isinstance(subject, str) or not subject.isascii() or not subject.isdecimal():
            return None
        user_id = int(subject)
        if not 1 <= user_id <= MAX_USER_ID:
            return None
        token_version = payload.get("ver", 0)
        if type(token_version) is not int or token_version < 0:
            return None
        expires_at = datetime.fromtimestamp(float(payload["exp"]), UTC)
        return AccessTokenClaims(user_id, token_version, expires_at)
    except (binascii.Error, jwt.PyJWTError, OverflowError, TypeError, ValueError):
        return None


def hash_access_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()
