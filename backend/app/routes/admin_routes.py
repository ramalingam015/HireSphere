from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    User, UserRole, RecruiterStatus, Job, Application, InterviewSlot,
    Post, PostComment, AuditLog
)
from app.schemas import UserOut, JobOut, ApplicationOut, RecruiterActionRequest, PostOut
from app.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["Administration"])

@router.get("/recruiters", response_model=List[UserOut])
def list_recruiters(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """FR-ADM-01: List all recruiters and their onboarding / active status."""
    return db.query(User).filter(User.role == UserRole.RECRUITER).order_by(User.created_at.desc()).all()

@router.post("/recruiters/{recruiter_id}/action", response_model=UserOut)
def recruiter_action(
    recruiter_id: int,
    action_in: RecruiterActionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    FR-ADM-01: Approve, reject, deactivate (suspend), or reactivate recruiter.
    FR-ADM-02: Deactivation applies Hold/Suspended overlay without changing underlying state.
    FR-ADM-04: BOOKED interviews of deactivated Recruiter cancelled and slots made unavailable.
    FR-ADM-05: Cancelled interview history preserved.
    FR-ADM-06: Existing jobs and applications preserved and not reassigned.
    FR-ADM-07: Reactivation removes overlay; cancelled interviews not recreated automatically.
    """
    recruiter = db.query(User).filter(User.id == recruiter_id, User.role == UserRole.RECRUITER).first()
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    target_status = action_in.status.lower()

    if target_status == "approved":
        recruiter.recruiter_status = RecruiterStatus.APPROVED
        recruiter.is_active = True
        
        # Remove hold overlay if previously suspended (FR-ADM-07)
        apps = db.query(Application).join(Job).filter(Job.recruiter_id == recruiter.id).all()
        for a in apps:
            a.is_hold_overlay = False

    elif target_status == "rejected":
        recruiter.recruiter_status = RecruiterStatus.REJECTED
        recruiter.is_active = False

    elif target_status in ["suspended", "deactivate", "deactivated"]:
        # FR-ADM-02: Recruiter deactivation
        recruiter.recruiter_status = RecruiterStatus.SUSPENDED
        
        # Apply Hold/Suspended overlay without changing underlying application state (FR-ADM-02, 03)
        apps = db.query(Application).join(Job).filter(Job.recruiter_id == recruiter.id).all()
        for a in apps:
            a.is_hold_overlay = True
            a.hold_previous_status = a.status

        # FR-ADM-04: BOOKED interviews cancelled and slots made unavailable
        slots = db.query(InterviewSlot).filter(InterviewSlot.recruiter_id == recruiter.id).all()
        for s in slots:
            if s.is_booked or not s.is_cancelled:
                s.is_cancelled = True
                s.cancelled_reason = f"Recruiter deactivated by administrator: {action_in.reason or 'Administrative review'}"
                # release booked relation but keep history preserved (FR-ADM-05)
                s.is_booked = False

    elif target_status in ["reactivate", "reactivated"]:
        # FR-ADM-07: Reactivation removes overlay; cancelled interviews not recreated automatically
        recruiter.recruiter_status = RecruiterStatus.APPROVED
        recruiter.is_active = True
        apps = db.query(Application).join(Job).filter(Job.recruiter_id == recruiter.id).all()
        for a in apps:
            a.is_hold_overlay = False

    db.add(AuditLog(
        user_id=admin.id,
        action=f"RECRUITER_{target_status.upper()}",
        resource_type="USER",
        resource_id=str(recruiter.id),
        details=action_in.reason or f"Recruiter status updated to {target_status}"
    ))

    db.commit()
    db.refresh(recruiter)
    return recruiter

@router.get("/spam-monitor")
def get_spam_and_activity_monitor(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Monitor student and recruiter activities for spam openings or applications.
    Detect potential spam keywords, bulk application spams, or empty profiles.
    """
    all_jobs = db.query(Job).order_by(Job.created_at.desc()).limit(50).all()
    all_apps = db.query(Application).order_by(Application.created_at.desc()).limit(50).all()

    # Heuristic spam flags
    flagged_jobs = []
    for j in all_jobs:
        # Check suspicious patterns like excessive exclamation, crypto/clickbait keywords, or explicit flag
        text = (j.title + " " + j.description).lower()
        is_suspicious = any(k in text for k in ["earn fast", "100% free money", "telegram", "whatsapp money", "guaranteed rich"]) or j.is_flagged_spam
        flagged_jobs.append({
            "job": {
                "id": j.id,
                "title": j.title,
                "company": j.company,
                "recruiter_id": j.recruiter_id,
                "recruiter_name": j.recruiter.full_name if j.recruiter else "Unknown",
                "is_active": j.is_active,
                "created_at": j.created_at
            },
            "is_suspicious": is_suspicious,
            "is_flagged": j.is_flagged_spam,
            "reason": j.spam_reason or ("Keyword trigger" if is_suspicious else "Normal")
        })

    flagged_apps = []
    for a in all_apps:
        flagged_apps.append({
            "application_id": a.id,
            "candidate_name": a.candidate.full_name if a.candidate else "Unknown",
            "candidate_email": a.candidate.email if a.candidate else "Unknown",
            "job_title": a.job.title if a.job else "Unknown",
            "ats_score": a.ats_score,
            "status": a.status,
            "is_flagged_spam": a.is_flagged_spam,
            "created_at": a.created_at
        })

    return {
        "jobs": flagged_jobs,
        "applications": flagged_apps,
        "total_jobs": db.query(Job).count(),
        "total_applications": db.query(Application).count(),
        "total_candidates": db.query(User).filter(User.role == UserRole.CANDIDATE).count(),
        "total_recruiters": db.query(User).filter(User.role == UserRole.RECRUITER).count(),
        "pending_recruiters": db.query(User).filter(User.recruiter_status == RecruiterStatus.PENDING).count()
    }

@router.post("/jobs/{job_id}/toggle-spam")
def toggle_job_spam(
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.is_flagged_spam = not job.is_flagged_spam
    job.is_active = not job.is_flagged_spam  # deactivate if marked spam
    db.commit()
    return {"is_flagged_spam": job.is_flagged_spam, "is_active": job.is_active}

@router.post("/posts/{post_id}/moderate")
def moderate_post(
    post_id: int,
    action: str = "hide",  # hide, unhide, delete
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """FR-ADM-08: Moderate inappropriate posts."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if action == "delete":
        db.delete(post)
    elif action == "unhide":
        post.is_hidden = False
    else:
        post.is_hidden = True

    db.commit()
    return {"message": f"Post moderation action '{action}' executed."}
