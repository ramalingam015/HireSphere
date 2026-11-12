from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import User, Complaint, Job, AuditLog
from app.schemas import ComplaintCreate, ComplaintOut
from app.auth import get_current_user

router = APIRouter(prefix="/api/complaints", tags=["Complaints & Feedback"])

@router.post("", response_model=ComplaintOut)
def create_complaint(
    req: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a complaint, suggestion, or spam report.
    Available to all logged-in candidates and recruiters.
    """
    if not req.subject.strip():
        raise HTTPException(status_code=400, detail="Subject cannot be empty.")
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description cannot be empty.")

    # Check target user if provided
    target_user = None
    if req.target_user_id:
        target_user = db.query(User).filter(User.id == req.target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found.")

    # Check target job if provided
    if req.target_job_id:
        target_job = db.query(Job).filter(Job.id == req.target_job_id).first()
        if not target_job:
            raise HTTPException(status_code=404, detail="Target job not found.")

    complaint = Complaint(
        user_id=current_user.id,
        category=req.category,
        target_user_id=req.target_user_id,
        target_job_id=req.target_job_id,
        subject=req.subject.strip(),
        description=req.description.strip(),
        status="PENDING",
        created_at=datetime.utcnow()
    )
    db.add(complaint)

    # Add audit log
    db.add(AuditLog(
        user_id=current_user.id,
        action="SUBMIT_COMPLAINT",
        resource_type="COMPLAINT",
        resource_id=None,
        details=f"Category: {req.category} | Subject: {req.subject[:50]}"
    ))

    db.commit()
    db.refresh(complaint)

    # Note: target_user_email is omitted (None) to protect user privacy
    return ComplaintOut(
        id=complaint.id,
        user_id=complaint.user_id,
        category=complaint.category,
        target_user_id=complaint.target_user_id,
        target_job_id=complaint.target_job_id,
        subject=complaint.subject,
        description=complaint.description,
        status=complaint.status,
        admin_notes=complaint.admin_notes or "",
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
        reporter_name=current_user.full_name,
        reporter_email=current_user.email,
        reporter_role=current_user.role,
        target_user_name=target_user.full_name if target_user else None,
        target_user_email=None,  # Never leak email in user-facing responses
        target_user_role=target_user.role if target_user else None
    )

@router.get("/my", response_model=List[ComplaintOut])
def get_my_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List complaints and suggestions filed by current user.
    Never reveals personal emails of reported users.
    """
    complaints = db.query(Complaint).filter(Complaint.user_id == current_user.id).order_by(Complaint.created_at.desc()).all()
    results = []
    for c in complaints:
        target = db.query(User).filter(User.id == c.target_user_id).first() if c.target_user_id else None
        results.append(ComplaintOut(
            id=c.id,
            user_id=c.user_id,
            category=c.category,
            target_user_id=c.target_user_id,
            target_job_id=c.target_job_id,
            subject=c.subject,
            description=c.description,
            status=c.status,
            admin_notes=c.admin_notes or "",
            created_at=c.created_at,
            updated_at=c.updated_at,
            reporter_name=current_user.full_name,
            reporter_email=current_user.email,
            reporter_role=current_user.role,
            target_user_name=target.full_name if target else None,
            target_user_email=None,  # Privacy safe
            target_user_role=target.role if target else None
        ))
    return results

@router.get("/search-target")
def search_reportable_target(
    q: str = "",
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Privacy-safe search for recruiters or users by name or company name.
    Does NOT dump all users and NEVER exposes personal emails/Gmails.
    Requires at least 2 characters.
    """
    clean_q = q.strip()
    if len(clean_q) < 2:
        return []

    pattern = f"%{clean_q}%"
    query = db.query(User).filter(
        User.id != current_user.id,
        User.role != "admin",
        (User.full_name.ilike(pattern) | User.company.ilike(pattern))
    )

    if role and role in ["recruiter", "candidate"]:
        query = query.filter(User.role == role)

    matches = query.limit(8).all()

    # Returns ONLY public name and organization — NO emails
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "role": u.role,
            "company": u.company or "",
            "location": u.location or ""
        }
        for u in matches
    ]
