from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import storage
from app.auth import get_current_user
from app.database import get_db
from app.models import Application, Job, User, UserRole

router = APIRouter(prefix="/api/files", tags=["Files"])


def _can_view_resume(db: Session, user: User, key: str) -> bool:
    """Admin: any. Candidate: own resumes. Recruiter: resumes applied to their own jobs."""
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.CANDIDATE:
        if user.resume_file_path == key:
            return True
        return db.query(Application.id).filter(
            Application.candidate_id == user.id, Application.resume_file_path == key
        ).first() is not None
    if user.role == UserRole.RECRUITER:
        return db.query(Application.id).join(Job, Application.job_id == Job.id).filter(
            Application.resume_file_path == key, Job.recruiter_id == user.id
        ).first() is not None
    return False


@router.get("/resumes/{filename}")
def get_resume(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """JWT-protected resume download, streamed by the backend from S3 storage."""
    key = storage.key_for(filename)
    # Same response whether the file is missing or forbidden, so keys can't be probed.
    if not _can_view_resume(db, current_user, key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    data = storage.read_resume(key)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline", "Cache-Control": "private, no-store"},
    )
