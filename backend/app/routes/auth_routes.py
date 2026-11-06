import random
from datetime import datetime, timedelta
import os
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import ADMIN_REGISTRATION_KEY, UPLOAD_DIR, MAX_RESUME_SIZE_BYTES
from app.services.ats_service import extract_text_from_pdf
from app.services.ai_service import extract_skills_from_text
from app.models import User, UserRole, RecruiterStatus
from app.schemas import (
    UserCreate, UserLogin, UserOut, UserProfileUpdate, Token,
    EmailVerificationRequest, ResendVerificationRequest, EmailVerificationResponse,
    TestEmailRequest, EmailConfigRequest, DemoLoginRequest
)
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.email_service import send_verification_email, get_email_service_status, update_email_configuration

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

    # Send verification email via SMTP or direct API
    email_sent, email_detail = send_verification_email(new_user.email, verification_code, new_user.full_name)

    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user,
        "email_sent": email_sent,
        "email_detail": email_detail,
        "dev_code": None,
        "message": (
            f"Account created! A 6-digit verification code has been emailed to {new_user.email}."
            if email_sent else
            f"Account created. {email_detail}"
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

    email_sent, email_detail = send_verification_email(user.email, code, user.full_name)
    return {
        "email_sent": email_sent,
        "email_detail": email_detail,
        "dev_code": None,
        "message": (
            f"A fresh 6-digit verification code has been dispatched to {user.email}."
            if email_sent else
            f"{email_detail}"
        )
    }

@router.get("/email-diagnostics")
def email_diagnostics():
    """
    Returns diagnostic details about server email configuration without leaking secret keys.
    """
    return get_email_service_status()

@router.post("/test-email")
def test_email(req: TestEmailRequest):
    """
    Test real email delivery to an address and receive the exact server response or error.
    """
    test_code = str(random.randint(100000, 999999))
    sent, detail = send_verification_email(req.email.strip(), test_code, "HireSphere Tester")
    return {
        "success": sent,
        "recipient": req.email.strip(),
        "detail": detail,
        "test_code": test_code
    }

@router.post("/configure-email")
def configure_email(req: EmailConfigRequest, db: Session = Depends(get_db)):
    """
    Configures email credentials at runtime and optionally sends a real test email to verify delivery.
    """
    update_email_configuration(
        brevo_api_key=req.brevo_api_key or "",
        resend_api_key=req.resend_api_key or "",
        sendgrid_api_key=req.sendgrid_api_key or "",
        smtp_user=req.smtp_user or "",
        smtp_password=req.smtp_password or "",
        smtp_host=req.smtp_host or "smtp.gmail.com",
        smtp_port=req.smtp_port or 465,
        from_email=req.from_email or req.smtp_user or ""
    )

    if req.test_recipient and "@" in req.test_recipient:
        test_code = str(random.randint(100000, 999999))
        sent, detail = send_verification_email(req.test_recipient.strip(), test_code, "HireSphere Tester")
        if sent:
            pending_user = db.query(User).filter(User.email == req.test_recipient.strip()).first()
            if pending_user and not pending_user.is_email_verified:
                pending_user.email_verification_code = test_code
                pending_user.email_verification_expiry = datetime.utcnow() + timedelta(hours=24)
                db.commit()

            return {
                "success": True,
                "message": f"Real verification email sent to {req.test_recipient}! Please check your inbox (and Spam folder).",
                "status": get_email_service_status()
            }
        else:
            return {
                "success": False,
                "message": f"Email delivery failed: {detail}",
                "detail": detail,
                "status": get_email_service_status()
            }

    return {
        "success": True,
        "message": "Email configuration updated successfully.",
        "status": get_email_service_status()
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
        
        email_sent, email_detail = send_verification_email(user.email, user.email_verification_code, user.full_name)
        msg = (
            f"Email not verified. A 6-digit verification code has been emailed to {user.email}. Please check your inbox (and Spam folder) to verify."
            if email_sent else
            f"Email not verified. ({email_detail}). Please verify your email before logging in."
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

@router.post("/demo-login", response_model=Token)
def demo_login(req: DemoLoginRequest, db: Session = Depends(get_db)):
    """
    Auto-provisions and immediately authenticates demo accounts for CS455 role switching.
    Guarantees that demo buttons in the Quick Switcher bar NEVER fail with 401 Unauthorized,
    even after a database wipe or fresh deployment.
    """
    role = (req.role or "candidate").strip().lower()

    demo_map = {
        "admin": {
            "email": "admin@recruit.com",
            "password": "admin123",
            "full_name": "Platform Administrator",
            "role": UserRole.ADMIN,
            "status": RecruiterStatus.APPROVED,
            "company": "HireSphere",
            "headline": "System Administrator & Compliance Officer",
            "bio": "Managing talent network integrity and verification.",
            "location": "Global",
            "skills": "Administration, Compliance, User Moderation"
        },
        "recruiter": {
            "email": "recruiter@techcorp.com",
            "password": "recruiter123",
            "full_name": "Elena Rostova",
            "role": UserRole.RECRUITER,
            "status": RecruiterStatus.APPROVED,
            "company": "CloudScale Systems",
            "headline": "Lead Technical Recruiter at CloudScale Systems",
            "bio": "Hiring top distributed systems and backend engineers.",
            "location": "San Francisco, CA",
            "skills": "Technical Recruiting, ATS, Interview Scheduling"
        },
        "pending_recruiter": {
            "email": "pending@startup.io",
            "password": "pending123",
            "full_name": "Marcus Vance",
            "role": UserRole.RECRUITER,
            "status": RecruiterStatus.PENDING,
            "company": "NextGen AI",
            "headline": "Founder & Talent Lead at NextGen AI",
            "bio": "Early stage stealth startup scaling founding engineering team.",
            "location": "Austin, TX",
            "skills": "Startups, AI Engineering, Executive Search"
        },
        "candidate": {
            "email": "student@university.edu",
            "password": "student123",
            "full_name": "Alex Rivera",
            "role": UserRole.CANDIDATE,
            "status": RecruiterStatus.APPROVED,
            "company": "",
            "headline": "Computer Science Graduate & Full Stack Developer",
            "bio": "Recent CS graduate passionate about modern web apps, distributed systems, and React.",
            "location": "Boston, MA",
            "skills": "Python, React, TypeScript, FastAPI, PostgreSQL"
        }
    }

    target = demo_map.get(role, demo_map["candidate"])
    user = db.query(User).filter(User.email == target["email"]).first()

    if not user:
        user = User(
            email=target["email"],
            hashed_password=get_password_hash(target["password"]),
            full_name=target["full_name"],
            role=target["role"],
            recruiter_status=target["status"],
            company=target["company"],
            headline=target["headline"],
            bio=target["bio"],
            location=target["location"],
            skills=target["skills"],
            is_active=True,
            is_email_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Guarantee demo accounts are active, email-verified, and have expected status
        updated = False
        if not user.is_active:
            user.is_active = True
            updated = True
        if not user.is_email_verified:
            user.is_email_verified = True
            updated = True
        if role == "pending_recruiter" and user.recruiter_status != RecruiterStatus.PENDING:
            user.recruiter_status = RecruiterStatus.PENDING
            updated = True
        elif role == "recruiter" and user.recruiter_status != RecruiterStatus.APPROVED:
            user.recruiter_status = RecruiterStatus.APPROVED
            updated = True
        if updated:
            db.commit()
            db.refresh(user)

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

    # Save to UPLOAD_DIR
    clean_name = re.sub(r'[^a-zA-Z0-9_\.-]', '_', file.filename)
    unique_filename = f"user_{current_user.id}_{uuid.uuid4().hex[:8]}_{clean_name}"
    file_path = UPLOAD_DIR / unique_filename
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

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
