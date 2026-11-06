import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import Job, JobSkill, User, UserRole, RecruiterStatus, Application
from app.schemas import JobCreate, JobUpdate, JobOut, SkillItem, AIMatchInfo
from app.auth import get_current_user, require_approved_recruiter
from app.services.ai_service import parse_natural_language_search, recommend_and_rank_jobs
from app.services.ats_service import extract_text_from_pdf

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

@router.get("", response_model=List[JobOut])
def list_jobs(
    search: Optional[str] = Query(None, description="Keywords in title or description"),
    location: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FR-SCH-01: Structured job search using explicit filters."""
    query = db.query(Job).join(User, Job.recruiter_id == User.id)
    
    # Do not show suspended recruiter jobs to candidates unless admin
    if current_user.role != UserRole.ADMIN:
        query = query.filter(User.recruiter_status != RecruiterStatus.SUSPENDED)
        query = query.filter(Job.is_active == True)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(Job.title.ilike(s), Job.description.ilike(s), Job.company.ilike(s)))
    if location:
        query = query.filter(or_(Job.location.ilike(f"%{location.strip()}%"), Job.job_type.ilike(f"%{location.strip()}%")))
    if job_type:
        query = query.filter(Job.job_type.ilike(f"%{job_type.strip()}%"))
    if skill:
        query = query.filter(Job.skills.any(JobSkill.skill_name.ilike(f"%{skill.strip()}%")))

    return query.order_by(Job.created_at.desc()).all()

@router.get("/ai-recommendations", response_model=List[JobOut])
@router.get("/ai-search", response_model=List[JobOut])
def ai_job_search_and_recommendations(
    q: Optional[str] = Query(None, description="Natural language search prompt, e.g. 'Looking for remote python react jobs'"),
    search: Optional[str] = Query(None, description="Keyword / title search"),
    location: Optional[str] = Query(None, description="Location filter"),
    job_type: Optional[str] = Query(None, description="Job type filter"),
    skill: Optional[str] = Query(None, description="Required skill filter"),
    rank_by_resume: bool = Query(True, description="Rank jobs using candidate profile resume and skills"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Intelligent AI Job Recommendations and Search.
    Combines:
    1. Candidate's profile resume (and past application resumes)
    2. Candidate's key skills, headline, and bio
    3. Natural language query intent (via Gemini/OpenAI or NLP extractor)
    4. Structured search filters (location, job_type, skills)
    Ranks openings by compatibility and provides transparent match scores and reasoning.
    """
    # Base query: active jobs from approved recruiters
    query = db.query(Job).join(User, Job.recruiter_id == User.id)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(User.recruiter_status != RecruiterStatus.SUSPENDED)
        query = query.filter(Job.is_active == True)

    # Apply explicit keyword/search if provided
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(Job.title.ilike(s), Job.description.ilike(s), Job.company.ilike(s)))

    # Fetch initial pool of active jobs
    all_jobs = query.all()

    if not all_jobs:
        return []

    # Retrieve candidate resume text
    resume_text = current_user.resume_text or ""
    if not resume_text and current_user.role == UserRole.CANDIDATE:
        # Fallback: check if candidate previously uploaded a resume in any job application
        latest_app = (
            db.query(Application)
            .filter(Application.candidate_id == current_user.id)
            .order_by(Application.created_at.desc())
            .first()
        )
        if latest_app and latest_app.resume_file_path and os.path.exists(latest_app.resume_file_path):
            try:
                with open(latest_app.resume_file_path, "rb") as rf:
                    resume_text = extract_text_from_pdf(rf.read())
                    # Cache in user profile for faster future recommendations
                    current_user.resume_text = resume_text
                    if not current_user.resume_filename:
                        current_user.resume_filename = latest_app.original_filename
                    if not current_user.resume_file_path:
                        current_user.resume_file_path = latest_app.resume_file_path
                    db.commit()
            except Exception:
                pass

    # Score, filter, and rank using AI Service
    ranked = recommend_and_rank_jobs(
        jobs=all_jobs,
        resume_text=resume_text if rank_by_resume else "",
        candidate_skills=current_user.skills or "",
        candidate_headline=current_user.headline or "",
        query=q or "",
        location_filter=location or "",
        job_type_filter=job_type or "",
        skill_filter=skill or ""
    )

    # Format output with AIMatchInfo attached
    output = []
    for item in ranked:
        job_obj = item["job"]
        job_out = JobOut.model_validate(job_obj)
        job_out.ai_match = AIMatchInfo(
            score=item["match_score"],
            level=item["match_level"],
            matched_skills=item["matched_skills"],
            missing_skills=item["missing_skills"],
            reasoning=item["reasoning"]
        )
        output.append(job_out)

    return output

@router.get("/my-postings", response_model=List[JobOut])
def list_my_job_postings(
    db: Session = Depends(get_db),
    recruiter: User = Depends(require_approved_recruiter)
):
    """List jobs created by logged-in recruiter."""
    return db.query(Job).filter(Job.recruiter_id == recruiter.id).order_by(Job.created_at.desc()).all()

@router.get("/{job_id}", response_model=JobOut)
def get_job_details(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FR-NET-06: Candidate need not be connected to a Recruiter to view a job or profile."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found")
    return job

@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    job_in: JobCreate,
    db: Session = Depends(get_db),
    recruiter: User = Depends(require_approved_recruiter)
):
    """
    FR-REC-01: Every job shall contain at least one required skill.
    FR-REC-02: Preferred skills are optional.
    """
    has_required = any(s.is_required for s in job_in.skills)
    if not has_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FR-REC-01 Violation: Every job must contain at least one required skill."
        )

    new_job = Job(
        recruiter_id=recruiter.id,
        title=job_in.title,
        company=job_in.company or recruiter.company or "Tech Company",
        location=job_in.location,
        job_type=job_in.job_type,
        experience_level=job_in.experience_level,
        salary_range=job_in.salary_range,
        description=job_in.description,
        application_deadline=job_in.application_deadline,
        is_active=True
    )
    db.add(new_job)
    db.flush()

    for s in job_in.skills:
        skill_entry = JobSkill(
            job_id=new_job.id,
            skill_name=s.skill_name.strip(),
            is_required=s.is_required
        )
        db.add(skill_entry)

    db.commit()
    db.refresh(new_job)
    return new_job

@router.put("/{job_id}", response_model=JobOut)
def update_job(
    job_id: int,
    job_update: JobUpdate,
    db: Session = Depends(get_db),
    recruiter: User = Depends(require_approved_recruiter)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found")
    if job.recruiter_id != recruiter.id and recruiter.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to edit this job")

    data = job_update.model_dump(exclude_unset=True)
    if "skills" in data and data["skills"] is not None:
        skills_in = job_update.skills
        if not any(s.is_required for s in skills_in):
            raise HTTPException(status_code=400, detail="Every job must contain at least one required skill.")
        
        # Replace skills
        db.query(JobSkill).filter(JobSkill.job_id == job.id).delete()
        for s in skills_in:
            db.add(JobSkill(job_id=job.id, skill_name=s.skill_name.strip(), is_required=s.is_required))
        del data["skills"]

    for k, v in data.items():
        setattr(job, k, v)

    db.commit()
    db.refresh(job)
    return job

@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    recruiter: User = Depends(require_approved_recruiter)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job opening not found")
    if job.recruiter_id != recruiter.id and recruiter.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to delete this job")

    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}
