import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env files (backend/.env or project root .env)
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

UPLOAD_DIR = BASE_DIR / "uploads" / "resumes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-cs455-key-998877665544332211")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

# Admin Authorization Key for Admin registrations
ADMIN_REGISTRATION_KEY = os.getenv("ADMIN_REGISTRATION_KEY", "CS455-ADMIN-2026")

# Default to SQLite for zero-config run, or use PostgreSQL if DATABASE_URL is set
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'recruitment.db'}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# AI Service Settings - Best Available APIs:
# 1. Google Gemini API (Recommended: Gemini Pro / Flash)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

# 2. OpenAI API
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# 3. Groq API
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# 4. Ollama local inference endpoint (falls back gracefully if unavailable)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

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

