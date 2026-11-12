import secrets
import base64
import json
import hmac
import hashlib
import time
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db
from app.models import User, UserRole, RecruiterStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# Try to use python-jose or pyjwt if installed; otherwise robust standard library HS256 JWT
class CustomJWTError(Exception):
    pass

try:
    from jose import JWTError as ImportedJWTError, jwt as jose_jwt
    JWTError = ImportedJWTError
    _use_jose = True
except ImportError:
    try:
        import jwt as pyjwt
        class JWTError(Exception):
            pass
        jose_jwt = pyjwt
        _use_jose = True
    except ImportError:
        JWTError = CustomJWTError
        _use_jose = False

def _b64_url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _b64_url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data)

def _builtin_jwt_encode(payload: dict, secret: str) -> str:
    header = {'alg': 'HS256', 'typ': 'JWT'}
    h_bytes = _b64_url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    # convert any datetime in payload
    clean_p = {}
    for k, v in payload.items():
        if isinstance(v, datetime):
            clean_p[k] = int(v.timestamp())
        else:
            clean_p[k] = v
    p_bytes = _b64_url_encode(json.dumps(clean_p, separators=(',', ':')).encode('utf-8'))
    signing_input = f'{h_bytes}.{p_bytes}'.encode('utf-8')
    sig = _b64_url_encode(hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest())
    return f'{h_bytes}.{p_bytes}.{sig}'

def _builtin_jwt_decode(token: str, secret: str) -> dict:
    parts = token.split('.')
    if len(parts) != 3:
        raise CustomJWTError('Invalid token format')
    h_str, p_str, sig_str = parts
    signing_input = f'{h_str}.{p_str}'.encode('utf-8')
    expected_sig = _b64_url_encode(hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest())
    if not hmac.compare_digest(sig_str, expected_sig):
        raise CustomJWTError('Invalid token signature')
    try:
        payload = json.loads(_b64_url_decode(p_str).decode('utf-8'))
    except Exception:
        raise CustomJWTError('Invalid payload encoding')
    if 'exp' in payload:
        if payload['exp'] < time.time():
            raise CustomJWTError('Token has expired')
    return payload

def new_verification_code() -> str:
    """Cryptographically secure 6-digit email verification code."""
    return f"{secrets.randbelow(900000) + 100000}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    if _use_jose:
        try:
            return jose_jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        except Exception:
            pass
    return _builtin_jwt_encode(to_encode, SECRET_KEY)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = None
    if _use_jose:
        try:
            payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except Exception:
            pass

    if payload is None:
        try:
            payload = _builtin_jwt_decode(token, SECRET_KEY)
        except Exception:
            raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Verify your email to use the platform."
        )
    return user

def require_candidate(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Candidate role required.")
    return current_user

def require_recruiter(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.RECRUITER and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Recruiter role required.")
    if current_user.role == UserRole.RECRUITER and current_user.recruiter_status == RecruiterStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recruiter account suspended by administrator.")
    return current_user

def require_approved_recruiter(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.ADMIN:
        return current_user
    if current_user.role != UserRole.RECRUITER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Recruiter role required.")
    if current_user.recruiter_status != RecruiterStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Recruiter functionality not available. Account status is: {current_user.recruiter_status}."
        )
    return current_user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Administrator role required.")
    return current_user
