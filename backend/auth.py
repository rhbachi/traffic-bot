from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import database

import os
SECRET_KEY = os.environ.get("SECRET_KEY", "trafficbot-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "role": role, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré")


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non authentifié")
    payload = _decode_token(credentials.credentials)
    user = database.get_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")
    if user["is_banned"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte suspendu")
    return user


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès administrateur requis")
    return current_user
