import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
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

# Ollama local inference endpoint (falls back gracefully if unavailable)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

# Maximum resume upload size in bytes (5 MB as per FR-DAT-02)
MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024
