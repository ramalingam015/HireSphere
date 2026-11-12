import hmac
from datetime import datetime, timedelta
import os
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import ADMIN_REGISTRATION_KEY, MAX_RESUME_SIZE_BYTES
from app import storage
from app.services.ats_service import extract_text_from_pdf
from app.services.ai_service import extract_skills_from_text
from app.models import User, UserRole, RecruiterStatus
from app.schemas import (
    UserCreate, UserLogin, UserOut, UserProfileUpdate, Token,
    EmailVerificationRequest, ResendVerificationRequest, EmailVerificationResponse,
    TestEmailRequest
)
from app.auth import (
    get_password_hash, verify_password, create_access_token, get_current_user, require_admin,
    new_verification_code,
)
from app.email_service import send_verification_email, get_email_service_status, user_facing_detail

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

MAX_VERIFICATION_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60
VERIFICATION_TTL = timedelta(hours=24)

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
    verification_code = new_verification_code()
    verification_expiry = datetime.utcnow() + VERIFICATION_TTL

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

    # Send verification email via SMTP or direct API
    email_sent, email_detail = send_verification_email(new_user.email, verification_code, new_user.full_name)

    # No JWT yet: the account must verify its email first (POST /verify-email issues the token).
    return {
        "access_token": None,
        "token_type": "bearer",
        "user": new_user,
        "email_sent": email_sent,
        "email_detail": user_facing_detail(email_sent, email_detail),
        "dev_code": None,
        "message": (
            f"Account created! A 6-digit verification code has been emailed to {new_user.email}."
            if email_sent else
            f"Account created. {user_facing_detail(email_sent, email_detail)}"
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

    if not user.email_verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code. Please request a new code."
        )

    if not hmac.compare_digest(user.email_verification_code.strip(), req.code.strip()):
        # Brute-force guard: a 6-digit code must not be guessable with unlimited tries.
        user.email_verification_attempts = (user.email_verification_attempts or 0) + 1
        if user.email_verification_attempts >= MAX_VERIFICATION_ATTEMPTS:
            user.email_verification_code = None
            user.email_verification_attempts = 0
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many incorrect codes. Please request a new verification code."
            )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit verification code. Please check and try again."
        )

    user.is_email_verified = True
    user.email_verification_code = None
    user.email_verification_attempts = 0
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

    # Cooldown: the time the last code was issued is expiry - TTL.
    if user.email_verification_expiry:
        issued_at = user.email_verification_expiry - VERIFICATION_TTL
        wait = RESEND_COOLDOWN_SECONDS - (datetime.utcnow() - issued_at).total_seconds()
        if wait > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {int(wait) + 1} seconds before requesting another code."
            )

    code = new_verification_code()
    user.email_verification_code = code
    user.email_verification_attempts = 0
    user.email_verification_expiry = datetime.utcnow() + VERIFICATION_TTL
    db.commit()

    email_sent, email_detail = send_verification_email(user.email, code, user.full_name)
    return {
        "email_sent": email_sent,
        "email_detail": user_facing_detail(email_sent, email_detail),
        "dev_code": None,
        "message": (
            f"A fresh 6-digit verification code has been dispatched to {user.email}."
            if email_sent else
            f"{user_facing_detail(email_sent, email_detail)}"
        )
    }

@router.get("/email-diagnostics")
def email_diagnostics():
    """
    Returns diagnostic details about server email configuration without leaking secret keys.
    """
    return get_email_service_status()

@router.post("/test-email")
def test_email(req: TestEmailRequest, admin: User = Depends(require_admin)):
    """
    Test real email delivery to an address and receive the exact server response or error.
    """
    test_code = new_verification_code()
    sent, detail = send_verification_email(req.email.strip(), test_code, "HireSphere Tester")
    return {
        "success": sent,
        "recipient": req.email.strip(),
        "detail": detail,
        "test_code": test_code
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
            user.email_verification_code = new_verification_code()
            user.email_verification_expiry = datetime.utcnow() + VERIFICATION_TTL
            db.commit()
        
        email_sent, email_detail = send_verification_email(user.email, user.email_verification_code, user.full_name)
        msg = (
            f"Email not verified. A 6-digit verification code has been emailed to {user.email}. Please check your inbox (and Spam folder) to verify."
            if email_sent else
            f"Email not verified. ({user_facing_detail(email_sent, email_detail)}). Please verify your email before logging in."
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


@router.post("/profile/resume", response_model=UserOut)
async def upload_profile_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload and parse candidate resume to profile.
    Extracts text, identifies skills, and stores resume for AI job search & recommendations.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FR-DAT-01 Violation: Resume upload must be in PDF format only."
        )

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_RESUME_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FR-DAT-02 Violation: Resume file size exceeds 5 MB limit ({len(pdf_bytes)} bytes)."
        )

    try:
        resume_text = extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from PDF: {str(e)}"
        )

    # Save to resume storage (S3 storage)
    clean_name = re.sub(r'[^a-zA-Z0-9_\.-]', '_', file.filename)
    unique_filename = f"user_{current_user.id}_{uuid.uuid4().hex[:8]}_{clean_name}"
    file_path = storage.save_resume(unique_filename, pdf_bytes)

    current_user.resume_file_path = str(file_path)
    current_user.resume_filename = file.filename
    current_user.resume_text = resume_text

    # Automatically extract skills to enhance profile
    extracted = extract_skills_from_text(resume_text)
    if extracted:
        existing_skills = [s.strip() for s in (current_user.skills or "").split(",") if s.strip()]
        existing_lower = {s.lower() for s in existing_skills}
        for s in extracted:
            if s.lower() not in existing_lower:
                existing_skills.append(s)
        current_user.skills = ", ".join(existing_skills)

    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/profile/resume", response_model=UserOut)
def delete_profile_resume(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove candidate resume from profile."""
    current_user.resume_file_path = None
    current_user.resume_filename = None
    current_user.resume_text = None
    db.commit()
    db.refresh(current_user)
    return current_user
