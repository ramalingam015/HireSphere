from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# Auth & User Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"

class UserBase(BaseModel):
    email: str
    full_name: str
    role: str = "candidate"  # candidate, recruiter, admin
    headline: Optional[str] = ""
    bio: Optional[str] = ""
    company: Optional[str] = ""
    location: Optional[str] = ""
    skills: Optional[str] = ""

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[str] = None

class UserOut(UserBase):
    id: int
    recruiter_status: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Job Schemas
class SkillItem(BaseModel):
    skill_name: str
    is_required: bool = True

class JobCreate(BaseModel):
    title: str
    company: str
    location: str = "Remote"
    job_type: str = "Full-time"
    experience_level: str = "Mid-level"
    salary_range: str = "$70,000 - $100,000"
    description: str
    skills: List[SkillItem]  # FR-REC-01: at least 1 required skill

class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_range: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    skills: Optional[List[SkillItem]] = None

class JobOut(BaseModel):
    id: int
    recruiter_id: int
    title: str
    company: str
    location: str
    job_type: str
    experience_level: str
    salary_range: str
    description: str
    is_active: bool
    is_flagged_spam: bool
    spam_reason: Optional[str] = ""
    created_at: datetime
    skills: List[SkillItem]
    recruiter: Optional[UserOut] = None

    class Config:
        from_attributes = True

# ATS Analysis Schemas
class ATSAnalysisResult(BaseModel):
    job_id: int
    job_title: str
    matched_skills: List[str]
    missing_skills: List[str]
    matched_required: List[str]
    missing_required: List[str]
    matched_preferred: List[str]
    missing_preferred: List[str]
    score: float  # Deterministic score 0 to 100
    formula_used: str
    is_ai_powered: bool = True
    ai_status_message: str = "Analysis complete."

# Application Schemas
class ApplicationCreate(BaseModel):
    job_id: int
    submit_without_ai_score: bool = False

class ApplicationStatusHistoryOut(BaseModel):
    id: int
    from_status: str
    to_status: str
    changed_by_user_id: int
    reason: Optional[str] = ""
    timestamp: datetime

    class Config:
        from_attributes = True

class ApplicationOut(BaseModel):
    id: int
    job_id: int
    candidate_id: int
    resume_file_path: str
    original_filename: str
    ats_score: Optional[float] = None
    matched_skills_json: str
    missing_skills_json: str
    status: str
    is_hold_overlay: bool
    hold_previous_status: Optional[str] = ""
    is_flagged_spam: bool
    created_at: datetime
    job: Optional[JobOut] = None
    candidate: Optional[UserOut] = None
    status_history: List[ApplicationStatusHistoryOut] = []

    class Config:
        from_attributes = True

class ApplicationStatusTransitionRequest(BaseModel):
    to_status: str
    reason: Optional[str] = ""

# Interview Slot Schemas
class InterviewSlotCreate(BaseModel):
    job_id: int
    start_time: datetime
    end_time: datetime
    selection_deadline: datetime
    meeting_link: Optional[str] = "https://meet.google.com/abc-defg-hij"
    notes: Optional[str] = ""

class InterviewSlotOut(BaseModel):
    id: int
    job_id: int
    recruiter_id: int
    start_time: datetime
    end_time: datetime
    selection_deadline: datetime
    meeting_link: str
    notes: Optional[str] = ""
    is_booked: bool
    booked_by_application_id: Optional[int] = None
    booked_by_candidate_id: Optional[int] = None
    is_cancelled: bool
    cancelled_reason: Optional[str] = ""
    created_at: datetime

    class Config:
        from_attributes = True

class BookSlotRequest(BaseModel):
    application_id: int
    slot_id: int

class ChangeSlotRequest(BaseModel):
    application_id: int
    new_slot_id: int

# Networking & Messaging Schemas
class ConnectionOut(BaseModel):
    id: int
    requester_id: int
    receiver_id: int
    status: str
    created_at: datetime
    other_user: Optional[UserOut] = None

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    recipient_id: int
    content: str  # text-only FR-NET-03

class MessageOut(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class PostCommentOut(BaseModel):
    id: int
    post_id: int
    author_id: int
    content: str
    is_hidden: bool
    created_at: datetime
    author: Optional[UserOut] = None

    class Config:
        from_attributes = True

class PostCreate(BaseModel):
    content: str

class CommentCreate(BaseModel):
    content: str

class PostOut(BaseModel):
    id: int
    author_id: int
    content: str
    is_hidden: bool
    created_at: datetime
    author: Optional[UserOut] = None
    likes_count: int = 0
    is_liked_by_me: bool = False
    comments: List[PostCommentOut] = []

    class Config:
        from_attributes = True

# Admin Schemas
class RecruiterActionRequest(BaseModel):
    status: str  # approved, rejected, suspended
    reason: Optional[str] = ""

class ContentModerationRequest(BaseModel):
    action: str  # hide, delete, unhide
    reason: Optional[str] = ""
