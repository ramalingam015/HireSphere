from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import Job, JobSkill, User, UserRole, RecruiterStatus
from app.schemas import JobCreate, JobUpdate, JobOut, SkillItem
from app.auth import get_current_user, require_approved_recruiter
from app.services.ai_service import parse_natural_language_search

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
        query = query.filter(Job.location.ilike(f"%{location.strip()}%"))
    if job_type:
        query = query.filter(Job.job_type.ilike(f"%{job_type.strip()}%"))
    if skill:
        query = query.filter(Job.skills.any(JobSkill.skill_name.ilike(f"%{skill.strip()}%")))

    return query.order_by(Job.created_at.desc()).all()

@router.get("/ai-search", response_model=List[JobOut])
def ai_job_search(
    q: str = Query(..., description="Natural language prompt, e.g. 'Looking for remote python react jobs'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FR-SCH-02 / FR-SCH-03: Natural language AI job search."""
    parsed = parse_natural_language_search(q)
    
    query = db.query(Job).join(User, Job.recruiter_id == User.id)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(User.recruiter_status != RecruiterStatus.SUSPENDED)
        query = query.filter(Job.is_active == True)

    if parsed.get("title"):
        query = query.filter(Job.title.ilike(f"%{parsed['title']}%"))
    if parsed.get("company"):
        query = query.filter(Job.company.ilike(f"%{parsed['company']}%"))
    if parsed.get("location"):
        query = query.filter(Job.location.ilike(f"%{parsed['location']}%"))
    if parsed.get("job_type"):
        query = query.filter(Job.job_type.ilike(f"%{parsed['job_type']}%"))
    if parsed.get("skills"):
        for sk in parsed["skills"]:
            query = query.filter(Job.skills.any(JobSkill.skill_name.ilike(f"%{sk}%")))
    if parsed.get("keyword"):
        k = f"%{parsed['keyword']}%"
        query = query.filter(or_(Job.title.ilike(k), Job.description.ilike(k), Job.company.ilike(k)))

    return query.order_by(Job.created_at.desc()).all()

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
