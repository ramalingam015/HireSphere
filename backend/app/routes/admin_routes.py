from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    User, UserRole, RecruiterStatus, Job, JobSkill, Application, ApplicationStatusHistory,
    InterviewSlot, Connection, Message, Post, PostLike, PostComment, AuditLog, Complaint
)
from app.schemas import (
    UserOut, JobOut, ApplicationOut, RecruiterActionRequest, PostOut, ResetDatabaseRequest,
    ComplaintOut, ComplaintActionRequest, UserBlockRequest
)
from app.auth import require_admin, get_password_hash
import app.config as config
from app import storage

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

@router.get("/users")
def list_all_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    List all platform users with roles, account states, blocked status, and complaint counts.
    Allows administrators to audit and moderate students and recruiters.
    """
    query = db.query(User)
    if role and role.lower() != "all":
        query = query.filter(User.role == role.lower())
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((User.full_name.ilike(s)) | (User.email.ilike(s)) | (User.company.ilike(s)))
    users = query.order_by(User.created_at.desc()).all()

    results = []
    for u in users:
        complaint_count = db.query(Complaint).filter(Complaint.target_user_id == u.id).count()
        results.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "company": u.company or "",
            "location": u.location or "",
            "is_active": u.is_active,
            "is_blocked": getattr(u, 'is_blocked', False),
            "block_reason": getattr(u, 'block_reason', ''),
            "recruiter_status": u.recruiter_status,
            "is_email_verified": u.is_email_verified,
            "complaints_count": complaint_count,
            "created_at": u.created_at
        })
    return results

@router.post("/users/{user_id}/block")
def toggle_user_block(
    user_id: int,
    req: UserBlockRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Block or unblock any candidate or recruiter based on user complaints or spam.
    Blocking cascades deactivation and cancels any active interview slots for recruiters.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot block an administrator account.")

    user.is_blocked = req.is_blocked
    user.block_reason = req.reason or ("Blocked by administrator" if req.is_blocked else "")
    user.is_active = not req.is_blocked

    # If recruiter is blocked, suspend recruiter account and cancel active booked interview slots
    if user.role == UserRole.RECRUITER and req.is_blocked:
        user.recruiter_status = RecruiterStatus.SUSPENDED
        slots = db.query(InterviewSlot).filter(InterviewSlot.recruiter_id == user.id).all()
        for s in slots:
            if s.is_booked or not s.is_cancelled:
                s.is_cancelled = True
                s.cancelled_reason = f"Recruiter blocked by administrator: {req.reason or 'Administrative moderation'}"
                s.is_booked = False

    action_text = "BLOCKED" if req.is_blocked else "UNBLOCKED"
    db.add(AuditLog(
        user_id=admin.id,
        action=f"USER_{action_text}",
        resource_type="USER",
        resource_id=str(user.id),
        details=req.reason or f"User account {action_text.lower()} by admin."
    ))

    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_blocked": user.is_blocked,
        "block_reason": user.block_reason
    }

@router.get("/complaints", response_model=List[ComplaintOut])
def list_admin_complaints(
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    List all submitted complaints, suggestions, and spam reports.
    """
    query = db.query(Complaint)
    if status and status.upper() != "ALL":
        query = query.filter(Complaint.status == status.upper())
    if category and category.lower() != "all":
        query = query.filter(Complaint.category == category.lower())
    complaints = query.order_by(Complaint.created_at.desc()).all()

    results = []
    for c in complaints:
        reporter = db.query(User).filter(User.id == c.user_id).first()
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
            reporter_name=reporter.full_name if reporter else "Unknown",
            reporter_email=reporter.email if reporter else "",
            reporter_role=reporter.role if reporter else "",
            target_user_name=target.full_name if target else None,
            target_user_email=target.email if target else None,
            target_user_role=target.role if target else None
        ))
    return results

@router.post("/complaints/{complaint_id}/action")
def act_on_complaint(
    complaint_id: int,
    req: ComplaintActionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Update status of complaint (RESOLVED, DISMISSED, PENDING) with administrator notes.
    """
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    c.status = req.status.upper()
    if req.admin_notes is not None:
        c.admin_notes = req.admin_notes
    c.updated_at = datetime.utcnow()
    db.commit()
    return {"id": c.id, "status": c.status, "admin_notes": c.admin_notes}

@router.get("/spam-monitor")
def get_spam_and_activity_monitor(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Comprehensive platform activity monitor and high-efficiency stats dashboard.
    """
    all_jobs = db.query(Job).order_by(Job.created_at.desc()).limit(50).all()
    all_apps = db.query(Application).order_by(Application.created_at.desc()).limit(50).all()

    flagged_jobs = []
    for j in all_jobs:
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

    total_apps = db.query(Application).count()
    interview_count = db.query(Application).filter(Application.status.in_(["Interview", "Selected"])).count()
    conversion_rate = round((interview_count / total_apps * 100), 1) if total_apps > 0 else 0.0

    # Calculate average ATS score
    scored_apps = db.query(Application).filter(Application.ats_score != None).all()
    avg_ats = round(sum(a.ats_score for a in scored_apps) / len(scored_apps), 1) if scored_apps else 0.0

    return {
        "jobs": flagged_jobs,
        "applications": flagged_apps,
        "total_jobs": db.query(Job).count(),
        "active_jobs": db.query(Job).filter(Job.is_active == True, Job.is_flagged_spam == False).count(),
        "spam_jobs_count": db.query(Job).filter(Job.is_flagged_spam == True).count(),
        "total_applications": total_apps,
        "conversion_rate": conversion_rate,
        "avg_ats_score": avg_ats,
        "total_users": db.query(User).count(),
        "total_candidates": db.query(User).filter(User.role == UserRole.CANDIDATE).count(),
        "total_recruiters": db.query(User).filter(User.role == UserRole.RECRUITER).count(),
        "pending_recruiters": db.query(User).filter(User.recruiter_status == RecruiterStatus.PENDING).count(),
        "suspended_recruiters": db.query(User).filter(User.recruiter_status == RecruiterStatus.SUSPENDED).count(),
        "blocked_users_count": db.query(User).filter(User.is_blocked == True).count(),
        "total_complaints": db.query(Complaint).count(),
        "pending_complaints": db.query(Complaint).filter(Complaint.status == "PENDING").count(),
        "resolved_complaints": db.query(Complaint).filter(Complaint.status == "RESOLVED").count()
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

@router.post("/comments/{comment_id}/moderate")
def moderate_comment(
    comment_id: int,
    action: str = "hide",  # hide, unhide, delete
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """FR-ADM-08: Administrators can hide or delete inappropriate comments."""
    comment = db.query(PostComment).filter(PostComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if action not in ("hide", "unhide", "delete"):
        raise HTTPException(status_code=400, detail="action must be hide, unhide or delete")

    if action == "delete":
        db.delete(comment)
    else:
        comment.is_hidden = (action == "hide")
    db.add(AuditLog(
        user_id=admin.id, action=f"COMMENT_{action.upper()}", resource_type="COMMENT",
        resource_id=str(comment_id), details=f"Comment moderation: {action}"
    ))
    db.commit()
    return {"message": f"Comment moderation action '{action}' executed."}


@router.post("/reset-database")
def reset_database_endpoint(
    req: ResetDatabaseRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Wipes all platform data (users, jobs, applications, interviews, messages, posts, resumes)
    and re-initializes a clean fresh admin account.
    Requires an administrator JWT *and* the ADMIN_REGISTRATION_KEY.
    """
    if req.admin_secret_key.strip() != config.ADMIN_REGISTRATION_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin secret key. Access denied."
        )

    # Delete records in foreign key safe order
    db.query(AuditLog).delete()
    db.query(PostComment).delete()
    db.query(PostLike).delete()
    db.query(Post).delete()
    db.query(Message).delete()
    db.query(Connection).delete()
    db.query(InterviewSlot).delete()
    db.query(ApplicationStatusHistory).delete()
    db.query(Application).delete()
    db.query(JobSkill).delete()
    db.query(Job).delete()
    db.query(User).delete()
    db.commit()

    # Re-create clean default Admin accounts and demo users for immediate testing
    clean_admin = User(
        email="admin@hiresphere.com",
        hashed_password=get_password_hash("Admin@123"),
        full_name="Platform Administrator",
        role=UserRole.ADMIN,
        is_active=True,
        is_email_verified=True
    )
    demo_admin = User(
        email="admin@recruit.com",
        hashed_password=get_password_hash("admin123"),
        full_name="Platform Administrator",
        role=UserRole.ADMIN,
        recruiter_status=RecruiterStatus.APPROVED,
        company="HireSphere",
        is_active=True,
        is_email_verified=True
    )
    demo_recruiter = User(
        email="recruiter@techcorp.com",
        hashed_password=get_password_hash("recruiter123"),
        full_name="Elena Rostova",
        role=UserRole.RECRUITER,
        recruiter_status=RecruiterStatus.APPROVED,
        company="CloudScale Systems",
        is_active=True,
        is_email_verified=True
    )
    demo_pending = User(
        email="pending@startup.io",
        hashed_password=get_password_hash("pending123"),
        full_name="Marcus Vance",
        role=UserRole.RECRUITER,
        recruiter_status=RecruiterStatus.PENDING,
        company="NextGen AI",
        is_active=True,
        is_email_verified=True
    )
    demo_candidate = User(
        email="student@university.edu",
        hashed_password=get_password_hash("student123"),
        full_name="Alex Rivera",
        role=UserRole.CANDIDATE,
        recruiter_status=RecruiterStatus.APPROVED,
        company="",
        is_active=True,
        is_email_verified=True
    )
    db.add_all([clean_admin, demo_admin, demo_recruiter, demo_pending, demo_candidate])
    db.commit()

    # Clean uploaded resume files
    try:
        storage.delete_all_resumes()
    except Exception as e:
        print(f"[RESET DB] Warning cleaning resumes: {e}")

    return {
        "success": True,
        "message": "Platform wiped completely! All user accounts, passwords, jobs, applications, and uploaded files have been deleted. Default admin created: admin@hiresphere.com / Admin@123"
    }

