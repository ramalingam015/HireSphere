import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Application, ApplicationState, ApplicationStatusHistory,
    Job, JobSkill, User, UserRole, RecruiterStatus
)
from app.schemas import (
    ApplicationOut, ATSAnalysisResult, ApplicationStatusTransitionRequest
)
from app.auth import get_current_user, require_candidate, require_recruiter
from app.config import UPLOAD_DIR, MAX_RESUME_SIZE_BYTES
from app.services.ats_service import extract_text_from_pdf, calculate_ats_score

router = APIRouter(prefix="/api/applications", tags=["Applications & ATS"])

# FR-STAT-01: Valid State Transitions Matrix
VALID_TRANSITIONS = {
    ApplicationState.APPLIED: [ApplicationState.IN_REVIEW, ApplicationState.WITHDRAWN],
    ApplicationState.IN_REVIEW: [ApplicationState.INTERVIEW, ApplicationState.REJECTED, ApplicationState.WITHDRAWN],
    ApplicationState.INTERVIEW: [ApplicationState.SELECTED, ApplicationState.REJECTED, ApplicationState.CANDIDATE_DECLINED],
    ApplicationState.SELECTED: [],  # Terminal
    ApplicationState.REJECTED: [],  # Terminal
    ApplicationState.WITHDRAWN: [],  # Terminal
    ApplicationState.CANDIDATE_DECLINED: []  # Terminal
}

@router.post("/pre-analyze-resume", response_model=ATSAnalysisResult)
async def pre_analyze_resume(
    job_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate)
):
    """
    FR-ANA-01 / FR-ANA-02 / FR-ANA-03:
    Candidate checks ATS score of resume against job requirements before applying.
    Can be run repeatedly with revised PDFs.
    """
    # FR-DAT-01: PDF only
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FR-DAT-01 Violation: Resume uploads must be in PDF format only."
        )

    # Read and check size FR-DAT-02
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_RESUME_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FR-DAT-02 Violation: Resume file size exceeds 5 MB limit ({len(pdf_bytes)} bytes)."
        )

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found")

    try:
        resume_text = extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        # FR-ERR-01: AI/Extraction failure prompt flow
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"PDF extraction failed: {str(e)}"
        )

    required_skills = [s.skill_name for s in job.skills if s.is_required]
    preferred_skills = [s.skill_name for s in job.skills if not s.is_required]

    result = calculate_ats_score(required_skills, preferred_skills, resume_text)

    return {
        "job_id": job.id,
        "job_title": job.title,
        "matched_skills": result["all_matched"],
        "missing_skills": result["all_missing"],
        "matched_required": result["matched_required"],
        "missing_required": result["missing_required"],
        "matched_preferred": result["matched_preferred"],
        "missing_preferred": result["missing_preferred"],
        "score": result["score"],
        "formula_used": result["formula"],
        "is_ai_powered": True,
        "ai_status_message": "ATS analysis completed successfully."
    }

@router.post("/apply", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def submit_application(
    job_id: int = Form(...),
    submit_without_ai_score: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate)
):
    """
    Submit job application.
    FR-REC-03: A Candidate may have only one application per unique job.
    FR-DAT-03: The exact PDF used at submission remains permanently associated.
    FR-ERR-02: Selecting 'Yes' in failure prompt submits without an AI score.
    """
    # FR-REC-03
    existing_app = db.query(Application).filter(
        Application.job_id == job_id,
        Application.candidate_id == candidate.id
    ).first()
    if existing_app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FR-REC-03 Violation: You have already submitted an application for this job opening."
        )

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found")
    if not job.is_active:
        raise HTTPException(status_code=400, detail="This job opening is no longer accepting applications.")

    # Validate PDF
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FR-DAT-01 Violation: Resume upload must be PDF only."
        )

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_RESUME_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FR-DAT-02 Violation: Resume exceeds 5 MB limit."
        )

    # Save permanently associated PDF (FR-DAT-03)
    file_id = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = UPLOAD_DIR / file_id
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    # Calculate ATS score unless candidate opted to submit without score (FR-ERR-02)
    ats_score = None
    matched_skills = []
    missing_skills = []

    if not submit_without_ai_score:
        try:
            resume_text = extract_text_from_pdf(pdf_bytes)
            required_skills = [s.skill_name for s in job.skills if s.is_required]
            preferred_skills = [s.skill_name for s in job.skills if not s.is_required]
            analysis = calculate_ats_score(required_skills, preferred_skills, resume_text)
            ats_score = analysis["score"]
            matched_skills = analysis["all_matched"]
            missing_skills = analysis["all_missing"]
        except Exception:
            # If failed and not opted out, still submit with score=None or notify
            ats_score = None

    # Check recruiter suspended overlay (FR-ADM-02)
    recruiter = job.recruiter
    is_hold = (recruiter.recruiter_status == RecruiterStatus.SUSPENDED)

    new_app = Application(
        job_id=job.id,
        candidate_id=candidate.id,
        resume_file_path=str(file_path),
        original_filename=file.filename,
        ats_score=ats_score,
        matched_skills_json=json.dumps(matched_skills),
        missing_skills_json=json.dumps(missing_skills),
        status=ApplicationState.APPLIED,
        is_hold_overlay=is_hold,
        hold_previous_status=ApplicationState.APPLIED if is_hold else ""
    )
    db.add(new_app)
    db.flush()

    # Record history
    history = ApplicationStatusHistory(
        application_id=new_app.id,
        from_status="None",
        to_status=ApplicationState.APPLIED,
        changed_by_user_id=candidate.id,
        reason="Application submitted"
    )
    db.add(history)
    db.commit()
    db.refresh(new_app)

    return new_app

@router.get("/my-applications", response_model=List[ApplicationOut])
def get_my_applications(
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate)
):
    """FR-GEN-03 / UC-C13: View candidate applications and real-time status."""
    return db.query(Application).filter(Application.candidate_id == candidate.id).order_by(Application.created_at.desc()).all()

@router.get("/job/{job_id}", response_model=List[ApplicationOut])
def get_job_applications(
    job_id: int,
    db: Session = Depends(get_db),
    recruiter: User = Depends(require_recruiter)
):
    """UC-R04: View applications for Recruiter's jobs with ATS scores."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found")
    if job.recruiter_id != recruiter.id and recruiter.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to view applications for this job")

    # Sorted by ATS score descending
    return db.query(Application).filter(Application.job_id == job_id).order_by(Application.ats_score.desc().nullslast()).all()

@router.post("/{app_id}/transition", response_model=ApplicationOut)
def transition_application_state(
    app_id: int,
    transition: ApplicationStatusTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    FR-STAT-01: Valid state transitions.
    FR-STAT-02: Selected, Rejected, Withdrawn, Candidate Declined are terminal.
    FR-STAT-03: Backward transitions prohibited.
    """
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    job = app.job
    # Permission check
    if current_user.role != UserRole.ADMIN and job.recruiter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to change application state")

    target_status = transition.to_status
    current_status = app.status

    # Validate transition
    allowed_next_states = VALID_TRANSITIONS.get(current_status, [])
    if target_status not in allowed_next_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FR-STAT-01 / FR-STAT-03 Violation: Invalid state transition from '{current_status}' to '{target_status}'. Allowed next states: {allowed_next_states}"
        )

    # Perform transition
    app.status = target_status
    history = ApplicationStatusHistory(
        application_id=app.id,
        from_status=current_status,
        to_status=target_status,
        changed_by_user_id=current_user.id,
        reason=transition.reason or f"Status changed by recruiter to {target_status}"
    )
    db.add(history)
    db.commit()
    db.refresh(app)
    return app

@router.post("/{app_id}/withdraw", response_model=ApplicationOut)
def withdraw_application(
    app_id: int,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate)
):
    """
    FR-STAT-04: Candidates may withdraw only from Applied or In Review.
    FR-STAT-05: Records of Withdrawn applications shall be preserved.
    """
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.candidate_id != candidate.id:
        raise HTTPException(status_code=403, detail="Not authorized to withdraw this application")

    if app.status not in [ApplicationState.APPLIED, ApplicationState.IN_REVIEW]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FR-STAT-04 Violation: Candidate may withdraw only from Applied or In Review. Current status is '{app.status}'."
        )

    old_status = app.status
    app.status = ApplicationState.WITHDRAWN
    history = ApplicationStatusHistory(
        application_id=app.id,
        from_status=old_status,
        to_status=ApplicationState.WITHDRAWN,
        changed_by_user_id=candidate.id,
        reason="Withdrawn by candidate"
    )
    db.add(history)
    db.commit()
    db.refresh(app)
    return app
