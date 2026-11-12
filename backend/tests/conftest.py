"""
Test setup. Needs PostgreSQL (TEST_DATABASE_URL, default: the compose `db` service) and uses an
in-memory fake S3 instead of the real S3 server. A dedicated test database is created/reset automatically.
"""
import io
import os
import sys
from pathlib import Path

import pytest
from botocore.exceptions import ClientError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

TEST_DB_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/recruitment_test"
)


def _ensure_test_database(url: str) -> None:
    u = make_url(url)
    admin = create_engine(u.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        exists = c.execute(text("SELECT 1 FROM pg_database WHERE datname=:n"), {"n": u.database}).scalar()
        if not exists:
            c.execute(text(f'CREATE DATABASE "{u.database}"'))
    admin.dispose()


_ensure_test_database(TEST_DB_URL)

# Must be set before the app is imported (config reads env at import time).
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["MINIO_ENDPOINT"] = "http://minio.invalid:9000"
os.environ["MINIO_ACCESS_KEY"] = "test"
os.environ["MINIO_SECRET_KEY"] = "test"
os.environ["CORS_ORIGINS"] = "https://hiresphere-cs455.web.app"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config, storage  # noqa: E402


class FakeS3:
    """Just enough of the boto3 S3 client API used by app.storage."""

    def __init__(self, bucket_exists=True):
        self.objects = {}
        self.buckets = {config.MINIO_BUCKET} if bucket_exists else set()

    def head_bucket(self, Bucket):
        if Bucket not in self.buckets:
            raise ClientError({"Error": {"Code": "404"}}, "HeadBucket")

    def create_bucket(self, Bucket):
        self.buckets.add(Bucket)

    def put_object(self, Bucket, Key, Body, ContentType=None):
        self.objects[(Bucket, Key)] = Body

    def get_object(self, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}

    def get_paginator(self, name):
        fake = self

        class P:
            def paginate(self, Bucket, Prefix):
                yield {"Contents": [{"Key": k} for (b, k) in fake.objects if b == Bucket and k.startswith(Prefix)]}
        return P()

    def delete_objects(self, Bucket, Delete):
        for o in Delete["Objects"]:
            self.objects.pop((Bucket, o["Key"]), None)


@pytest.fixture(autouse=True)
def fake_s3(monkeypatch):
    """Every test gets a fresh in-memory bucket; nothing ever reaches a real S3 server."""
    fake = FakeS3()
    monkeypatch.setattr(storage, "_s3", lambda: fake)
    return fake


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.database import Base, engine
    import main

    Base.metadata.drop_all(bind=engine)  # clean slate in the dedicated test DB
    storage._s3 = lambda: FakeS3()  # lifespan calls ensure_bucket before per-test patching
    with TestClient(main.app) as c:  # lifespan: create tables + seed demo data
        yield c


def make_pdf(text_: str) -> bytes:
    """Build a minimal valid one-page PDF containing `text_`."""
    stream = f"BT /F1 12 Tf 20 100 Td ({text_}) Tj ET"
    objs = [
        "<</Type/Catalog/Pages 2 0 R>>",
        "<</Type/Pages/Kids[3 0 R]/Count 1>>",
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R"
        "/Resources<</Font<</F1 5 0 R>>>>>>",
        f"<</Length {len(stream)}>>\nstream\n{stream}\nendstream",
        "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]
    out, offs = "%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n"
    out += "".join(f"{o:010d} 00000 n \n" for o in offs)
    out += f"trailer<</Size {len(objs) + 1}/Root 1 0 R>>\nstartxref\n{xref}\n%%EOF"
    return out.encode()


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def student(client):
    return login(client, "student@university.edu", "student123")


@pytest.fixture(scope="session")
def recruiter(client):
    return login(client, "recruiter@techcorp.com", "recruiter123")


@pytest.fixture(scope="session")
def admin(client):
    return login(client, "admin@recruit.com", "admin123")


@pytest.fixture(scope="session")
def other_student(client):
    """A second candidate with no relation to the first student's resumes."""
    from app.auth import get_password_hash
    from app.database import SessionLocal
    from app.models import RecruiterStatus, User, UserRole

    db = SessionLocal()
    try:
        db.add(User(
            email="other@university.edu", hashed_password=get_password_hash("other123"),
            full_name="Other Student", role=UserRole.CANDIDATE,
            recruiter_status=RecruiterStatus.APPROVED, is_active=True, is_email_verified=True,
        ))
        db.commit()
    finally:
        db.close()
    return login(client, "other@university.edu", "other123")


def make_user(email, password="pw-123456", role="candidate", **fields):
    """Insert a verified, active user directly (no email flow) and return its id."""
    from app.auth import get_password_hash
    from app.database import SessionLocal
    from app.models import RecruiterStatus, User

    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(email=email, hashed_password=get_password_hash(password), full_name=fields.pop("full_name", email.split("@")[0]),
                     role=role, recruiter_status=fields.pop("recruiter_status", RecruiterStatus.APPROVED),
                     is_active=True, is_email_verified=True, **fields)
            db.add(u)
            db.commit()
            db.refresh(u)
        return u.id
    finally:
        db.close()
