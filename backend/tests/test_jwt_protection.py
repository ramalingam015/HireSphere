"""JWT enforcement: every non-auth endpoint needs a token; resume access is role/ownership checked."""
import pytest
from fastapi.routing import APIRoute  # noqa: F401  (kept for clarity of intent)

from .conftest import make_pdf

PUBLIC = {
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/verify-email"),
    ("POST", "/api/auth/resend-verification"),
    ("GET", "/api/auth/email-diagnostics"),
    ("GET", "/api/health"),
    ("GET", "/"),  # static banner
}


def test_only_expected_endpoints_are_public(client):
    """Fails if someone adds an endpoint without a JWT dependency."""
    public = set()
    for path, ops in client.get("/openapi.json").json()["paths"].items():
        for method, op in ops.items():
            if "security" not in op:
                public.add((method.upper(), path))
    assert public == PUBLIC


def test_reset_database_requires_admin_jwt(client, student, recruiter):
    body = {"admin_secret_key": "CS455-ADMIN-2026"}
    assert client.post("/api/admin/reset-database", json=body).status_code == 401
    assert client.post("/api/admin/reset-database", json=body, headers=student).status_code == 403
    assert client.post("/api/admin/reset-database", json=body, headers=recruiter).status_code == 403


def test_test_email_requires_admin_jwt(client, student):
    assert client.post("/api/auth/test-email", json={"email": "a@b.co"}).status_code == 401
    assert client.post("/api/auth/test-email", json={"email": "a@b.co"}, headers=student).status_code == 403


@pytest.mark.parametrize("token", ["garbage", "a.b.c", ""])
def test_bad_tokens_rejected(client, token):
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code in (401, 403)


def test_token_with_non_numeric_subject_is_401_not_500(client):
    from app.auth import create_access_token
    t = create_access_token({"sub": "not-a-number"})
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_token_signed_with_other_key_rejected(client):
    from jose import jwt
    t = jwt.encode({"sub": "1"}, "some-other-secret", algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_legacy_open_uploads_route_is_gone(client):
    assert client.get("/uploads/resumes/anything.pdf").status_code in (404, 405)


def test_resume_access_rules(client, student, other_student, recruiter, admin):
    # the student applies to a job that techcorp's recruiter owns
    pdf = make_pdf("Python SQL private resume")
    r = None
    for job in client.get("/api/jobs/my-postings", headers=recruiter).json():
        if not job["is_active"]:
            continue
        r = client.post("/api/applications/apply", data={"job_id": job["id"]},
                        files={"file": ("secret.pdf", pdf, "application/pdf")}, headers=student)
        if r.status_code == 201:
            break
    assert r is not None and r.status_code == 201, r.text if r is not None else "no active job"
    name = r.json()["resume_file_path"].split("/")[-1]
    url = f"/api/files/resumes/{name}"

    assert client.get(url).status_code == 401                              # no token
    assert client.get(url, headers=student).content == pdf                 # owner
    assert client.get(url, headers=recruiter).content == pdf               # recruiter of that job
    assert client.get(url, headers=admin).content == pdf                   # admin
    assert client.get(url, headers=other_student).status_code == 404       # unrelated candidate
