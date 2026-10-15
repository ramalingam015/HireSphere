import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import ADMIN_REGISTRATION_KEY
from app.models import User, UserRole, RecruiterStatus
from app.schemas import (
    UserCreate, UserLogin, UserOut, UserProfileUpdate, Token,
    EmailVerificationRequest, ResendVerificationRequest, EmailVerificationResponse
)
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.email_service import send_verification_email

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register")
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    
    # 1. Admin Registration Authentication Gate
    if user_in.role == UserRole.ADMIN:
        if not user_in.admin_secret_key or user_in.admin_secret_key.strip() != ADMIN_REGISTRATION_KEY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unauthorized: Administrator registration requires a valid Admin Security Passcode. Contact system owners."
            )

    # FR-ADM-01: Recruiter accounts require administrator approval
    initial_status = RecruiterStatus.PENDING if user_in.role == UserRole.RECRUITER else RecruiterStatus.APPROVED

    # 3. Generate 6-Digit Email Verification Code
    verification_code = str(random.randint(100000, 999999))
    verification_expiry = datetime.utcnow() + timedelta(hours=24)

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        recruiter_status=initial_status,
        headline=user_in.headline or "",
        bio=user_in.bio or "",
        company=user_in.company or "",
        location=user_in.location or "",
        skills=user_in.skills or "",
        is_active=True,
        is_email_verified=False,
        email_verification_code=verification_code,
        email_verification_expiry=verification_expiry
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Send verification email via SMTP (or log to console if SMTP is not configured)
    email_sent = send_verification_email(new_user.email, verification_code, new_user.full_name)

    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user,
        "email_sent": email_sent,
        "dev_code": None if email_sent else verification_code,
        "message": (
            f"Account created! A 6-digit verification code has been emailed to {new_user.email}."
            if email_sent else
            f"Account created! (Real email requires SMTP configured on server. Code logged to server console)."
        )
    }

@router.post("/verify-email", response_model=EmailVerificationResponse)
def verify_email(req: EmailVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if user.is_email_verified:
        token = create_access_token({"sub": str(user.id), "role": user.role})
        return {
            "message": "Email is already verified.",
            "is_verified": True,
            "access_token": token,
            "token_type": "bearer",
            "user": user
        }

    if user.email_verification_expiry and datetime.utcnow() > user.email_verification_expiry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    if not user.email_verification_code or user.email_verification_code.strip() != req.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit verification code. Please check and try again."
        )

    user.is_email_verified = True
    user.email_verification_code = None
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "message": "Email verified successfully! Welcome to HireSphere.",
        "is_verified": True,
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/resend-verification")
def resend_verification(req: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_email_verified:
        return {"message": "Email is already verified.", "is_verified": True}

    code = str(random.randint(100000, 999999))
    user.email_verification_code = code
    user.email_verification_expiry = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    email_sent = send_verification_email(user.email, code, user.full_name)
    return {
        "email_sent": email_sent,
        "dev_code": None if email_sent else code,
        "message": (
            f"A fresh 6-digit verification code has been dispatched to {user.email}."
            if email_sent else
            f"New verification code generated. (SMTP not configured on server yet)."
        )
    }

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator."
        )
    
    # Check if email is verified
    if not user.is_email_verified:
        if not user.email_verification_code:
            user.email_verification_code = str(random.randint(100000, 999999))
            user.email_verification_expiry = datetime.utcnow() + timedelta(hours=24)
            db.commit()
        
        email_sent = send_verification_email(user.email, user.email_verification_code, user.full_name)
        msg = (
            f"Email not verified. A 6-digit verification code has been sent to {user.email}. Please verify your email before logging in."
            if email_sent else
            f"Email not verified. A 6-digit verification code was dispatched to {user.email}. (Dev Code: {user.email_verification_code})"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=msg
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserOut)
def update_profile(
    update_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    for field, val in update_data.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(current_user, field, val)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/users/{user_id}/profile", response_model=UserOut)
def view_public_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """FR-GEN-03: Any authenticated user shall be able to view another user's professional profile."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
