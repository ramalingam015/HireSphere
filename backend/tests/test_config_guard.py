"""APP_ENV=production must refuse dev defaults (checked in a subprocess: config reads env at import)."""
import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent

GOOD = {
    "APP_ENV": "production",
    "DATABASE_URL": "postgresql://postgres:S3cure-db-pass@db:5432/x",
    "SECRET_KEY": "a" * 40,
    "ADMIN_REGISTRATION_KEY": "not-the-default",
    "CORS_ORIGINS": "https://hiresphere-cs455.web.app",
    "MINIO_ENDPOINT": "http://minio:9000",
    "MINIO_ACCESS_KEY": "hs_minio",
    "MINIO_SECRET_KEY": "s3cure-minio-pass",
}


def run(**overrides):
    env = {k: v for k, v in os.environ.items() if k not in GOOD and k not in ("SECRET_KEY",)}
    env.update(GOOD)
    env.update(overrides)
    return subprocess.run(
        [sys.executable, "-c", "import sys; sys.path.insert(0, '.'); import app.config"],
        cwd=BACKEND, env=env, capture_output=True, text=True,
    )


def test_production_with_good_settings_starts():
    assert run().returncode == 0


def test_production_rejects_each_dev_default():
    cases = {
        "SECRET_KEY": "dev-only-secret-change-me",
        "ADMIN_REGISTRATION_KEY": "CS455-ADMIN-2026",
        "DATABASE_URL": "postgresql://postgres:postgrespassword@db:5432/x",
        "MINIO_SECRET_KEY": "minioadmin",
    }
    for name, bad in cases.items():
        r = run(**{name: bad})
        assert r.returncode != 0, f"{name}={bad} should be refused"
        assert "Refusing to start" in r.stderr


def test_short_secret_rejected():
    assert run(SECRET_KEY="short").returncode != 0


def test_development_allows_defaults():
    r = run(APP_ENV="development", SECRET_KEY="dev-only-secret-change-me", CORS_ORIGINS="*")
    assert r.returncode == 0
