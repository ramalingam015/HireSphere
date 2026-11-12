import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# backend/.env (backend/.env.example documents every variable). The frontend has its own env file.
load_dotenv(BASE_DIR / ".env")

def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            "See .env.example (run `docker compose up -d db storage` for local PostgreSQL + S3 storage)."
        )
    return value

_DEV_SECRET_KEYS = {"super-secret-cs455-key-998877665544332211", "dev-only-secret-change-me"}
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-cs455-key-998877665544332211")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()

# Admin Authorization Key for Admin registrations
_DEV_ADMIN_KEY = "CS455-ADMIN-2026"
ADMIN_REGISTRATION_KEY = os.getenv("ADMIN_REGISTRATION_KEY", _DEV_ADMIN_KEY)

# PostgreSQL is required, e.g. postgresql://user:pass@localhost:5432/dbname
DATABASE_URL = _require("DATABASE_URL")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# AI: Google Gemini (set GEMINI_API_KEY; without it the built-in heuristics are used)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", "")).strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip()

# MinIO / S3-compatible object storage for resumes (required; only the backend talks to it).
MINIO_ENDPOINT = _require("MINIO_ENDPOINT")  # e.g. http://localhost:8333
MINIO_ACCESS_KEY = _require("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = _require("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "hiresphere").strip()
MINIO_REGION = os.getenv("MINIO_REGION", "us-east-1").strip()

# Allowed browser origins, comma-separated. Default "*" = any origin (open CORS, intentional for the demo).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# Maximum resume upload size in bytes (5 MB as per FR-DAT-02)
MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024

# SMTP & Email Dispatcher Settings
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
try:
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587").strip())
except Exception:
    SMTP_PORT = 587
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USER or "noreply@hiresphere.com"
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "HireSphere Recruitment").strip()

# Direct API Keys (alternative to SMTP for maximum reliability)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "").strip()




# ---------------------------------------------------------------------------
# Production guard: with APP_ENV=production the API refuses to start on dev defaults.
# ---------------------------------------------------------------------------
if APP_ENV == "production":
    _problems = []
    if SECRET_KEY in _DEV_SECRET_KEYS or len(SECRET_KEY) < 32:
        _problems.append("SECRET_KEY must be set to a random value of 32+ characters (openssl rand -hex 32)")
    if ADMIN_REGISTRATION_KEY == _DEV_ADMIN_KEY:
        _problems.append("ADMIN_REGISTRATION_KEY must not be the default")
    if ":postgrespassword@" in DATABASE_URL:
        _problems.append("POSTGRES_PASSWORD must not be the default")
    if MINIO_SECRET_KEY == "minioadmin" or MINIO_ACCESS_KEY == "minioadmin":
        _problems.append("MINIO_ROOT_USER / MINIO_ROOT_PASSWORD must not be the defaults")
    if _problems:
        raise RuntimeError("Refusing to start with APP_ENV=production:\n  - " + "\n  - ".join(_problems))
