from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db, is_sqlite
from app.models import (
    InterviewSlot, Application, ApplicationState, ApplicationStatusHistory,
    Job, User, UserRole, RecruiterStatus
)
from app.schemas import (
    InterviewSlotCreate, InterviewSlotOut, BookSlotRequest, ChangeSlotRequest
)
from app.auth import get_current_user, require_candidate, require_recruiter

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])

@router.post("/slots", response_model=InterviewSlotOut, status_code=status.HTTP_201_CREATED)
def create_interview_slot(
    slot_in: InterviewSlotCreate,
    db: Session = Depends(get_db),
    recruiter: User = Depends(require_recruiter)
):
    """FR-REC-04: Recruiters shall create available interview slots for their jobs."""
    job = db.query(Job).filter(Job.id == slot_in.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.recruiter_id != recruiter.id and recruiter.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to create slots for this job")

    if slot_in.start_time >= slot_in.end_time:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    slot = InterviewSlot(
        job_id=job.id,
        recruiter_id=recruiter.id,
        start_time=slot_in.start_time,
        end_time=slot_in.end_time,
        selection_deadline=slot_in.selection_deadline,
        meeting_link=slot_in.meeting_link or "https://meet.google.com/interview",
        notes=slot_in.notes or "",
        is_booked=False,
        is_cancelled=False
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot

@router.get("/slots/job/{job_id}", response_model=List[InterviewSlotOut])
def get_slots_for_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """View slots for a job opening."""
    return db.query(InterviewSlot).filter(
        InterviewSlot.job_id == job_id,
        InterviewSlot.is_cancelled == False
    ).order_by(InterviewSlot.start_time.asc()).all()

@router.post("/book", response_model=InterviewSlotOut)
def book_interview_slot(
    req: BookSlotRequest,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate)
):
    """
    FR-REC-05: A Candidate in Interview shall be able to select exactly one available slot.
    FR-CON-01 / 02 / 04: Finite shared resource with transactional row-level locking.
    Concurrent attempts result in HTTP 409 Conflict.
    """
    app = db.query(Application).filter(Application.id == req.application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.candidate_id != candidate.id:
        raise HTTPException(status_code=403, detail="Not your application")
    if app.status != ApplicationState.INTERVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"FR-REC-05 Violation: Candidate must be in 'Interview' state to book a slot. Current status: {app.status}"
        )

    # Check if candidate already booked a slot for this application
    existing_booking = db.query(InterviewSlot).filter(
        InterviewSlot.booked_by_application_id == app.id,
        InterviewSlot.is_cancelled == False
    ).first()
    if existing_booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FR-REC-05 Violation: Candidate already has a booked slot. Use 'change' endpoint to reschedule."
        )

    try:
        # Atomic lock row for update (PostgreSQL: FOR UPDATE; SQLite uses immediate lock)
        slot_query = db.query(InterviewSlot).filter(InterviewSlot.id == req.slot_id)
        if not is_sqlite:
            slot_query = slot_query.with_for_update()
        slot = slot_query.first()

        if not slot:
            raise HTTPException(status_code=404, detail="Interview slot not found")
        if slot.job_id != app.job_id:
            raise HTTPException(status_code=400, detail="Slot does not belong to this application's job")
        if slot.is_cancelled:
            raise HTTPException(status_code=400, detail="Interview slot was cancelled")
        
        # FR-CON-04: Conflict if already claimed
        if slot.is_booked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="FR-CON-04: This interview slot has already been booked by another candidate. Please select another slot."
            )

        # Check deadline
        if datetime.utcnow() > slot.selection_deadline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Deadline to select this interview slot has passed."
            )

        slot.is_booked = True
        slot.booked_by_application_id = app.id
        slot.booked_by_candidate_id = candidate.id
        db.commit()
        db.refresh(slot)
        return slot
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/change-time", response_model=InterviewSlotOut)
def change_interview_time(
    req: ChangeSlotRequest,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate)
):
    """
    FR-REC-06: Candidate in Interview can atomically release old slot and claim new slot.
    FR-CON-03: Change interview time shall be atomic; if new slot cannot be acquired, original booking remains.
    """
    app = db.query(Application).filter(Application.id == req.application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.candidate_id != candidate.id:
        raise HTTPException(status_code=403, detail="Not your application")
    if app.status != ApplicationState.INTERVIEW:
        raise HTTPException(status_code=400, detail="Application not in Interview status")

    try:
        # Find currently booked slot
        old_slot_q = db.query(InterviewSlot).filter(
            InterviewSlot.booked_by_application_id == app.id,
            InterviewSlot.is_cancelled == False
        )
        if not is_sqlite:
            old_slot_q = old_slot_q.with_for_update()
        old_slot = old_slot_q.first()

        if not old_slot:
            raise HTTPException(status_code=400, detail="No active interview booking found to change.")

        if old_slot.id == req.new_slot_id:
            return old_slot

        # Lock new slot
        new_slot_q = db.query(InterviewSlot).filter(InterviewSlot.id == req.new_slot_id)
        if not is_sqlite:
            new_slot_q = new_slot_q.with_for_update()
        new_slot = new_slot_q.first()

        if not new_slot:
            raise HTTPException(status_code=404, detail="Target interview slot not found")
        if new_slot.job_id != app.job_id:
            raise HTTPException(status_code=400, detail="Slot belongs to a different job")
        if new_slot.is_cancelled:
            raise HTTPException(status_code=400, detail="Target slot is cancelled")

        # Conflict check FR-CON-04
        if new_slot.is_booked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="FR-CON-04 / FR-CON-03: Target slot is already booked. Original booking was preserved."
            )

        if datetime.utcnow() > new_slot.selection_deadline:
            raise HTTPException(status_code=400, detail="Deadline to select this slot has passed.")

        # Atomic Swap
        old_slot.is_booked = False
        old_slot.booked_by_application_id = None
        old_slot.booked_by_candidate_id = None

        new_slot.is_booked = True
        new_slot.booked_by_application_id = app.id
        new_slot.booked_by_candidate_id = candidate.id

        db.commit()
        db.refresh(new_slot)
        return new_slot
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/close/{application_id}")
def close_interview(
    application_id: int,
    db: Session = Depends(get_db),
    candidate: User = Depends(require_candidate)
):
    """
    FR-REC-07: Closing an Interview shall release the booked slot and move the application to Candidate Declined.
    """
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.candidate_id != candidate.id:
        raise HTTPException(status_code=403, detail="Not your application")
    if app.status != ApplicationState.INTERVIEW:
        raise HTTPException(status_code=400, detail="Can only close an interview while in Interview stage")

    # Release any booked slot
    slot = db.query(InterviewSlot).filter(
        InterviewSlot.booked_by_application_id == app.id
    ).first()
    if slot:
        slot.is_booked = False
        slot.booked_by_application_id = None
        slot.booked_by_candidate_id = None

    # Move application to Candidate Declined
    old_status = app.status
    app.status = ApplicationState.CANDIDATE_DECLINED

    history = ApplicationStatusHistory(
        application_id=app.id,
        from_status=old_status,
        to_status=ApplicationState.CANDIDATE_DECLINED,
        changed_by_user_id=candidate.id,
        reason="Interview closed by candidate (Candidate Declined)"
    )
    db.add(history)
    db.commit()

    return {"message": "Interview closed successfully. Slot released and application moved to Candidate Declined."}
