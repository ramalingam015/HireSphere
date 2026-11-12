"""API tests: health, auth, CORS, resume upload/download and the apply flow."""
from .conftest import make_pdf

BIG = b"%PDF-" + b"0" * (5 * 1024 * 1024 + 1)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "healthy"


def test_login_rejects_bad_password(client):
    r = client.post("/api/auth/login", json={"email": "student@university.edu", "password": "wrong"})
    assert r.status_code == 401


def test_protected_route_requires_token(client):
    assert client.get("/api/auth/me").status_code in (401, 403)


def test_cors_allows_firebase_origin_only(client):
    ok = client.options(
        "/api/auth/login",
        headers={"Origin": "https://hiresphere-cs455.web.app", "Access-Control-Request-Method": "POST"},
    )
    assert ok.headers.get("access-control-allow-origin") == "https://hiresphere-cs455.web.app"
    bad = client.options(
        "/api/auth/login",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_profile_resume_upload_and_download(client, student):
    pdf = make_pdf("Python FastAPI Docker SQL")
    r = client.post("/api/auth/profile/resume", files={"file": ("cv.pdf", pdf, "application/pdf")}, headers=student)
    assert r.status_code == 200, r.text
    assert r.json()["resume_filename"] == "cv.pdf"
    name = r.json()["resume_file_path"].replace("\\", "/").split("/")[-1]

    d = client.get(f"/api/files/resumes/{name}", headers=student)
    assert d.status_code == 200
    assert d.headers["content-type"] == "application/pdf"
    assert d.content == pdf


def test_download_missing_resume_404(client, student):
    assert client.get("/api/files/resumes/does-not-exist.pdf", headers=student).status_code == 404


def test_resume_must_be_pdf(client, student):
    r = client.post("/api/auth/profile/resume", files={"file": ("cv.txt", b"hello", "text/plain")}, headers=student)
    assert r.status_code == 400


def test_resume_size_limit(client, student):
    r = client.post("/api/auth/profile/resume", files={"file": ("big.pdf", BIG, "application/pdf")}, headers=student)
    assert r.status_code == 400 and "5 MB" in r.json()["detail"]


def test_apply_flow_stores_resume_and_blocks_duplicates(client, student, recruiter):
    jobs = client.get("/api/jobs", headers=student).json()
    assert jobs, "seed data should contain jobs"
    job_id = jobs[0]["id"]
    pdf = make_pdf("Python SQL Docker")

    r = client.post("/api/applications/apply", data={"job_id": job_id},
                    files={"file": ("apply.pdf", pdf, "application/pdf")}, headers=student)
    assert r.status_code == 201, r.text
    app = r.json()
    assert app["status"] == "Applied"

    # FR-REC-03: one application per job
    dup = client.post("/api/applications/apply", data={"job_id": job_id},
                      files={"file": ("apply.pdf", pdf, "application/pdf")}, headers=student)
    assert dup.status_code == 400

    # FR-DAT-03: the exact submitted PDF stays retrievable
    name = app["resume_file_path"].replace("\\", "/").split("/")[-1]
    assert client.get(f"/api/files/resumes/{name}", headers=student).content == pdf
