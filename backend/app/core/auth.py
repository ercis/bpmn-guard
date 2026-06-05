import logging
import time
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ValidationError

from .config import get_settings

logger = logging.getLogger(__name__)

# Demo mode skips token validation entirely, but FastAPI's OAuth2 dependency still
# wants a header. Setting auto_error=False so requests without an Authorization header
# don't 401 in demo mode.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


class TokenPayload(BaseModel):
    sub: str  # The user's unique ID (UUID)
    aud: str
    role: str
    exp: int


def mint_demo_token() -> str:
    """Mint a long-lived HS256 JWT for the demo user. Used by tests and the frontend shim."""
    settings = get_settings()
    payload = {
        "sub": settings.DEMO_USER_ID,
        "aud": settings.AUDIENCE,
        "role": "authenticated",
        "exp": int(time.time()) + 60 * 60 * 24 * 365 * 10,  # 10 years
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def get_current_user(token: Annotated[str | None, Depends(oauth2_scheme)]) -> TokenPayload:
    """
    Dependency that returns the authenticated user.

    In DEMO_MODE the token is ignored and a fixed demo identity is returned, so the
    artifact runs without any external auth provider. Flip DEMO_MODE off to verify a
    real HS256 JWT signed with JWT_SECRET.
    """
    settings = get_settings()

    if settings.DEMO_MODE:
        return TokenPayload(
            sub=settings.DEMO_USER_ID,
            aud=settings.AUDIENCE,
            role="authenticated",
            exp=int(time.time()) + 60 * 60 * 24 * 365 * 10,
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            key=settings.JWT_SECRET,
            algorithms=[settings.ALGORITHM],
            audience=settings.AUDIENCE,
        )
        token_data = TokenPayload(**payload)
        logger.info(f"User authenticated: {token_data.sub} (role: {token_data.role})")
        return token_data
    except (JWTError, ValidationError) as e:
        logger.warning(f"Authentication failed: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
