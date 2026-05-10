"""
auth.py — JWT authentication for SmartSchedule
Install deps:  pip install python-jose[cryptography] "passlib[bcrypt]" "bcrypt==4.0.1"

Teacher accounts live in TEACHER_ACCOUNTS below.
In production, move these to a database or environment variables.

To generate a new password hash, run:
  python -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt()).decode())"

Then paste the result as the value for that username below.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

# ── config ────────────────────────────────────────────────────────────────────
# Override SECRET_KEY via environment variable in production!
SECRET_KEY = os.getenv("SMARTSCHEDULE_SECRET", "change-me-before-production-very-long-random-string")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 8

TEACHER_ACCOUNTS: dict[str, str] = {
    "admin": "$2b$12$/rvXzv1Hho2f8toWdhAwIueLsYGNW2X/.geNdATPuSrbqP8dUFDHC",
}

# ── schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

# ── helpers ───────────────────────────────────────────────────────────────────

def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())

def _create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def authenticate_teacher(username: str, password: str) -> Optional[str]:
    """Return username if credentials are valid, else None."""
    hashed = TEACHER_ACCOUNTS.get(username)
    if not hashed or not _verify_password(password, hashed):
        return None
    return username

# ── FastAPI dependency ────────────────────────────────────────────────────────

bearer_scheme = HTTPBearer(auto_error=False)

def require_teacher(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    """
    FastAPI dependency — add to any endpoint that requires teacher auth:
        @app.post("/api/some/protected")
        def protected(teacher: str = Depends(require_teacher)):
            ...
    """
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Невалиден или липсващ токен.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise exc
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None or username not in TEACHER_ACCOUNTS:
            raise exc
        return username
    except JWTError:
        raise exc
