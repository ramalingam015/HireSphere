from sqlalchemy import inspect, text
from app.database import engine

def run_auto_migrations():
    """
    Safely adds newly added columns to existing tables across PostgreSQL & SQLite
    without data loss or requiring manual SQL alter statements.
    """
    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        with engine.begin() as conn:
            if "users" in existing_tables:
                user_cols = {c["name"] for c in inspector.get_columns("users")}
                if "is_email_verified" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE"))
                    conn.execute(text("UPDATE users SET is_email_verified = TRUE WHERE is_email_verified IS NULL OR is_email_verified = FALSE"))
                    print("[MIGRATION] Added is_email_verified column to users.")
                if "email_verification_code" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN email_verification_code VARCHAR(10)"))
                    print("[MIGRATION] Added email_verification_code column to users.")
                if "email_verification_expiry" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN email_verification_expiry TIMESTAMP"))
                    print("[MIGRATION] Added email_verification_expiry column to users.")

            if "jobs" in existing_tables:
                job_cols = {c["name"] for c in inspector.get_columns("jobs")}
                if "application_deadline" not in job_cols:
                    conn.execute(text("ALTER TABLE jobs ADD COLUMN application_deadline TIMESTAMP"))
                    print("[MIGRATION] Added application_deadline column to jobs.")
    except Exception as e:
        print(f"[MIGRATION WARNING] Auto-migration check: {e}")
