from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"

class RecruiterStatus(str):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class ApplicationState(str):
    APPLIED = "Applied"
    IN_REVIEW = "In Review"
    INTERVIEW = "Interview"
    SELECTED = "Selected"
    REJECTED = "Rejected"
    WITHDRAWN = "Withdrawn"
    CANDIDATE_DECLINED = "Candidate Declined"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default=UserRole.CANDIDATE)
    
    # Recruiter approval workflow (FR-ADM-01..07)
    recruiter_status = Column(String(50), default=RecruiterStatus.APPROVED)
    
    headline = Column(String(255), default="")
    bio = Column(Text, default="")
    company = Column(String(255), default="")
    location = Column(String(255), default="")
    skills = Column(Text, default="")  # comma separated
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    jobs = relationship("Job", back_populates="recruiter", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="candidate", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), index=True, nullable=False)
    company = Column(String(255), index=True, nullable=False)
    location = Column(String(255), default="Remote")
    job_type = Column(String(100), default="Full-time")  # Full-time, Remote, Internship, etc.
    experience_level = Column(String(100), default="Mid-level")
    salary_range = Column(String(100), default="$70,000 - $100,000")
    description = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    is_flagged_spam = Column(Boolean, default=False)
    spam_reason = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    recruiter = relationship("User", back_populates="jobs")
    skills = relationship("JobSkill", back_populates="job", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")
    interview_slots = relationship("InterviewSlot", back_populates="job", cascade="all, delete-orphan")

class JobSkill(Base):
    __tablename__ = "job_skills"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill_name = Column(String(100), nullable=False)
    is_required = Column(Boolean, default=True)  # True = Required (MR/TR), False = Preferred (MP/TP)

    job = relationship("Job", back_populates="skills")

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resume_file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    ats_score = Column(Float, nullable=True)  # Deterministic score 0-100 or None if skipped
    matched_skills_json = Column(Text, default="[]")
    missing_skills_json = Column(Text, default="[]")
    
    # State machine (FR-STAT-01..05)
    status = Column(String(50), default=ApplicationState.APPLIED, nullable=False)
    
    # Administrative Hold overlay (FR-ADM-02..03)
    is_hold_overlay = Column(Boolean, default=False)
    hold_previous_status = Column(String(50), default="")
    
    is_flagged_spam = Column(Boolean, default=False)
    spam_notes = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_candidate_job_application"),
    )

    # Relationships
    job = relationship("Job", back_populates="applications")
    candidate = relationship("User", back_populates="applications")
    status_history = relationship("ApplicationStatusHistory", back_populates="application", cascade="all, delete-orphan")
    booked_slot = relationship("InterviewSlot", back_populates="booked_application", uselist=False)

class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    from_status = Column(String(50), nullable=False)
    to_status = Column(String(50), nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(255), default="")
    timestamp = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="status_history")

class InterviewSlot(Base):
    __tablename__ = "interview_slots"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    selection_deadline = Column(DateTime, nullable=False)
    meeting_link = Column(String(500), default="https://meet.google.com/abc-defg-hij")
    notes = Column(Text, default="")
    
    is_booked = Column(Boolean, default=False)
    booked_by_application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    booked_by_candidate_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # FR-ADM-04: Booked interviews cancelled if recruiter deactivated
    is_cancelled = Column(Boolean, default=False)
    cancelled_reason = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="interview_slots")
    booked_application = relationship("Application", back_populates="booked_slot")
    booked_candidate = relationship("User", foreign_keys=[booked_by_candidate_id])
    recruiter = relationship("User", foreign_keys=[recruiter_id])

class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), default="PENDING")  # PENDING, ACCEPTED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("requester_id", "receiver_id", name="uq_user_connection"),
    )

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)  # FR-NET-03: text only
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_hidden = Column(Boolean, default=False)  # FR-ADM-08
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = relationship("User", back_populates="posts")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan")

class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_like"),
    )

    post = relationship("Post", back_populates="likes")

class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_hidden = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, default="")
    timestamp = Column(DateTime, default=datetime.utcnow)
