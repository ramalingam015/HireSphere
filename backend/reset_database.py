"""
Standalone Database Reset Utility for HireSphere
Run with: python backend/reset_database.py
Wipes all users, jobs, applications, interviews, messages, posts, and resumes,
then seeds the default admin user: admin@hiresphere.com / Admin@123
"""
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal, engine, Base
from app.models import (
    User, UserRole, RecruiterStatus, Job, JobSkill, Application, ApplicationStatusHistory,
    InterviewSlot, Connection, Message, Post, PostLike, PostComment, AuditLog
)
from app.auth import get_password_hash
import app.config as config

def reset_all_data():
    print("=======================================================")
    print("HireSphere Database Reset Utility")
    print(f"Database Target: {config.DATABASE_URL.split('@')[-1] if '@' in config.DATABASE_URL else config.DATABASE_URL}")
    print("=======================================================")

    db = SessionLocal()
    try:
        print("[1/3] Deleting all existing records...")
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
        print("  ✓ All database records successfully wiped.")

        print("[2/3] Seeding clean default administrator and demo accounts...")
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
        print("  ✓ Admin seeded: admin@hiresphere.com (Password: Admin@123)")
        print("  ✓ Demo accounts seeded for Quick Switcher (Alex Rivera, Elena Rostova, Marcus Vance, Admin Portal)")

        print("[3/3] Clearing uploaded resume files...")
        cleaned_files = 0
        if config.UPLOAD_DIR.exists():
            for f in config.UPLOAD_DIR.iterdir():
                if f.is_file():
                    f.unlink()
                    cleaned_files += 1
        print(f"  ✓ Cleaned {cleaned_files} uploaded resume file(s).")

        print("\n=======================================================")
        print("SUCCESS! HireSphere has been reset to brand-new state.")
        print("Login with:")
        print("  Email:    admin@hiresphere.com")
        print("  Password: Admin@123")
        print("=======================================================\n")
    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Database reset failed: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("Are you sure you want to WIPE all user and platform data? (y/N): ")
    if confirm.lower() == "y":
        reset_all_data()
    else:
        print("Reset cancelled.")
