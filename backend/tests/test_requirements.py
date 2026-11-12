"""Tests for requirements from Deliverable 1 that were previously unenforced or untested."""
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import pytest

from app.database import SessionLocal
from app.models import Application, ApplicationState, InterviewSlot, Job
from app.services import ai_service
from .conftest import login, make_pdf, make_user


def uniq(prefix="u"):
    return f"{prefix}{uuid.uuid4().hex[:8]}@example.com"


def candidate(client):
    email = uniq("cand")
    uid = make_user(email)
    return uid, login(client, email, "pw-123456")


# ---------------------------------------------------------------- FR-SEC-02
def test_sanitizer_strips_pii_but_keeps_skills_and_year_ranges():
    text = ("Jane Doe jane.doe+cv@gmail.com +1 (415) 555-0199 https://linkedin.com/in/jane www.jane.dev\n"
            "2019 - 2023  Python, Docker, SQL")
    out = ai_service.sanitize_for_ai(text)
    assert "@" not in out and "555" not in out and "linkedin" not in out and "jane.dev" not in out
    assert "[email]" in out and "[phone]" in out and "[link]" in out
    assert "2019 - 2023" in out and "Python, Docker, SQL" in out


def test_resume_text_sent_to_gemini_contains_no_pii(monkeypatch):
    sent = []
    monkeypatch.setattr(ai_service, "GEMINI_API_KEY", "k")

    class R:
        status_code = 200
        text = ""

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": '{"skills": ["Python"]}'}]}}]}
    monkeypatch.setattr(ai_service.requests, "post", lambda url, json=None, **kw: sent.append(json) or R())
    ai_service.extract_skills_from_text("Contact: me@secret.org, 98765 43210 12. Skills: Python")
    payload = str(sent[0])
    assert "secret.org" not in payload and "98765" not in payload and "Python" in payload


# ---------------------------------------------------------------- FR-SCH-04
def test_search_params_validation_reports_rejections():
    cleaned, issues = ai_service.validate_search_params({
        "title": " Backend ", "skills": "python", "job_type": 5, "salary": "999k", "keyword": None,
        "location": "x" * 500, "company": "Acme"})
    assert cleaned == {"title": "Backend", "company": "Acme"}
    joined = " ".join(issues)
    assert "skills" in joined and "job_type" in joined and "salary" in joined and "location" in joined


def test_ai_search_endpoint_reports_rejected_parameters(client, student, monkeypatch):
    monkeypatch.setattr(ai_service, "GEMINI_API_KEY", "k")

    class R:
        status_code = 200
        text = ""

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": '{"keyword": "python", "salary": "999k"}'}]}}]}
    monkeypatch.setattr(ai_service.requests, "post", lambda *a, **k: R())
    r = client.get("/api/jobs/ai-search", params={"q": "python jobs"}, headers=student)
    assert r.status_code == 200
    assert "salary" in r.headers.get("x-ai-search-notice", "")


# ---------------------------------------------------------------- FR-NET-01 / FR-NET-02
def test_connections_require_acceptance_before_messaging(client):
    a_id, a = candidate(client)
    b_id, b = candidate(client)
    c = client.post(f"/api/networking/connect/{b_id}", headers=a)
    assert c.status_code == 200 and c.json()["status"] == "PENDING"
    conn_id = c.json()["id"]

    msg = {"recipient_id": b_id, "content": "hi"}
    assert client.post("/api/networking/messages", json=msg, headers=a).status_code == 403   # not accepted yet
    assert client.post(f"/api/networking/connections/{conn_id}/accept", headers=a).status_code == 403  # only receiver
    assert client.post(f"/api/networking/connections/{conn_id}/accept", headers=b).json()["status"] == "ACCEPTED"
    assert client.post("/api/networking/messages", json=msg, headers=a).status_code == 201
    assert client.post("/api/networking/messages", json={"recipient_id": a_id, "content": "yo"}, headers=b).status_code == 201


def test_rejected_connection_cannot_message_and_can_be_removed(client):
    a_id, a = candidate(client)
    b_id, b = candidate(client)
    conn_id = client.post(f"/api/networking/connect/{b_id}", headers=a).json()["id"]
    assert client.post(f"/api/networking/connections/{conn_id}/reject", headers=b).json()["status"] == "REJECTED"
    assert client.post("/api/networking/messages", json={"recipient_id": b_id, "content": "x"}, headers=a).status_code == 403
    assert client.post(f"/api/networking/connections/{conn_id}/accept", headers=b).status_code == 409  # already answered
    assert client.delete(f"/api/networking/connections/{conn_id}", headers=a).status_code == 200


def test_connecting_back_accepts_a_pending_request(client):
    a_id, a = candidate(client)
    b_id, b = candidate(client)
    client.post(f"/api/networking/connect/{b_id}", headers=a)
    assert client.post(f"/api/networking/connect/{a_id}", headers=b).json()["status"] == "ACCEPTED"


def test_messaging_a_stranger_is_forbidden_even_for_recruiters(client, recruiter):
    sid, _ = candidate(client)
    assert client.post("/api/networking/messages", json={"recipient_id": sid, "content": "x"}, headers=recruiter).status_code == 403


# ---------------------------------------------------------------- FR-SEC-01 / FR-STAT / FR-ADM
def apply_to_recruiter_job(client, cand_headers, recruiter):
    pdf = make_pdf("Python SQL Docker")
    for job in client.get("/api/jobs/my-postings", headers=recruiter).json():
        if not job["is_active"]:
            continue
        r = client.post("/api/applications/apply", data={"job_id": job["id"]},
                        files={"file": ("a.pdf", pdf, "application/pdf")}, headers=cand_headers)
        if r.status_code == 201:
            return r.json()["id"], job["id"]
    pytest.fail("no active job accepted the application")


def test_recruiter_cannot_set_candidate_only_states(client, recruiter):
    _, cand = candidate(client)
    app_id, _ = apply_to_recruiter_job(client, cand, recruiter)
    t = lambda to: client.post(f"/api/applications/{app_id}/transition", json={"to_status": to}, headers=recruiter)
    assert t("Withdrawn").status_code == 403           # FR-STAT-04: candidate's decision
    assert t("In Review").status_code == 200
    assert t("Interview").status_code == 200
    assert t("Candidate Declined").status_code == 403  # FR-REC-07: candidate's decision
    assert t("Applied").status_code == 400             # FR-STAT-03: no backward moves


def test_other_or_unapproved_recruiters_cannot_change_state(client, recruiter, admin):
    _, cand = candidate(client)
    app_id, _ = apply_to_recruiter_job(client, cand, recruiter)
    body = {"to_status": "In Review"}
    pending = login(client, "pending@startup.io", "pending123")
    assert client.post(f"/api/applications/{app_id}/transition", json=body, headers=pending).status_code == 403
    other_email = uniq("rec")
    make_user(other_email, role="recruiter")
    other = login(client, other_email, "pw-123456")
    assert client.post(f"/api/applications/{app_id}/transition", json=body, headers=other).status_code == 403  # not their job
    assert client.post(f"/api/applications/{app_id}/transition", json=body).status_code == 401


def test_suspended_recruiter_is_frozen_and_held_apps_cannot_change(client, recruiter, admin):
    _, cand = candidate(client)
    app_id, _ = apply_to_recruiter_job(client, cand, recruiter)
    rec = client.get("/api/auth/me", headers=recruiter).json()
    act = lambda status: client.post(f"/api/admin/recruiters/{rec['id']}/action", json={"status": status, "reason": "test"}, headers=admin)
    try:
        assert act("suspended").status_code == 200
        body = {"to_status": "In Review"}
        assert client.post(f"/api/applications/{app_id}/transition", json=body, headers=recruiter).status_code == 403
        assert client.post(f"/api/applications/{app_id}/transition", json=body, headers=admin).status_code == 409  # on hold
    finally:
        assert act("reactivate").status_code == 200
    assert client.post(f"/api/applications/{app_id}/transition", json={"to_status": "In Review"}, headers=recruiter).status_code == 200


def test_admin_can_hide_and_delete_comments(client, student, admin):
    post = client.post("/api/networking/posts", json={"content": "hello network"}, headers=student).json()
    cm = client.post(f"/api/networking/posts/{post['id']}/comments", json={"content": "spammy comment"}, headers=student).json()
    feed = lambda: next(p for p in client.get("/api/networking/feed", headers=student).json() if p["id"] == post["id"])
    assert any(c["id"] == cm["id"] for c in feed()["comments"])
    assert client.post(f"/api/admin/comments/{cm['id']}/moderate", params={"action": "hide"}, headers=student).status_code == 403
    assert client.post(f"/api/admin/comments/{cm['id']}/moderate", params={"action": "hide"}, headers=admin).status_code == 200
    assert not any(c["id"] == cm["id"] for c in feed()["comments"])
    assert client.post(f"/api/admin/comments/{cm['id']}/moderate", params={"action": "delete"}, headers=admin).status_code == 200
    assert client.post(f"/api/admin/comments/{cm['id']}/moderate", params={"action": "hide"}, headers=admin).status_code == 404


# ---------------------------------------------------------------- FR-CON-01..04 (real PostgreSQL locking)
def make_interview_candidate(job_id):
    email = uniq("ivw")
    uid = make_user(email)
    db = SessionLocal()
    try:
        app = Application(job_id=job_id, candidate_id=uid, resume_file_path="resumes/x.pdf",
                          original_filename="x.pdf", status=ApplicationState.INTERVIEW)
        db.add(app)
        db.commit()
        return email, app.id
    finally:
        db.close()


def make_slots(client, recruiter, job_id, n):
    now = datetime.utcnow() + timedelta(days=2)
    slots = []
    for i in range(n):
        r = client.post("/api/interviews/slots", headers=recruiter, json={
            "job_id": job_id, "start_time": (now + timedelta(hours=i * 3)).isoformat(),
            "end_time": (now + timedelta(hours=i * 3 + 1)).isoformat(),
            "selection_deadline": (now - timedelta(hours=1)).isoformat() if False else (datetime.utcnow() + timedelta(days=1)).isoformat()})
        assert r.status_code == 201, r.text
        slots.append(r.json()["id"])
    return slots


def active_job_id(client, recruiter):
    return next(j["id"] for j in client.get("/api/jobs/my-postings", headers=recruiter).json() if j["is_active"])


def test_concurrent_booking_one_winner_rest_conflict(client, recruiter):
    """FR-CON-02/04: N simultaneous requests for one slot -> exactly one 200, the rest 409."""
    import main
    from fastapi.testclient import TestClient

    job_id = active_job_id(client, recruiter)
    (slot_id,) = make_slots(client, recruiter, job_id, 1)
    n = 8
    people = [make_interview_candidate(job_id) for _ in range(n)]
    tokens = [login(client, email, "pw-123456") for email, _ in people]

    barrier = threading.Barrier(n)

    def book(i):
        c = TestClient(main.app)  # own client per thread, no lifespan
        barrier.wait()
        return c.post("/api/interviews/book", json={"application_id": people[i][1], "slot_id": slot_id}, headers=tokens[i]).status_code

    with ThreadPoolExecutor(max_workers=n) as pool:
        codes = list(pool.map(book, range(n)))
    assert sorted(codes) == [200] + [409] * (n - 1), codes

    db = SessionLocal()
    try:
        slot = db.query(InterviewSlot).filter(InterviewSlot.id == slot_id).one()
        assert slot.is_booked and slot.booked_by_application_id in [a for _, a in people]
        assert db.query(InterviewSlot).filter(InterviewSlot.booked_by_application_id == slot.booked_by_application_id).count() == 1
    finally:
        db.close()


def test_change_time_failure_keeps_original_booking(client, recruiter):
    """FR-CON-03: if the new slot cannot be acquired the original booking remains."""
    job_id = active_job_id(client, recruiter)
    slot_a, slot_b = make_slots(client, recruiter, job_id, 2)
    (e1, app1), (e2, app2) = make_interview_candidate(job_id), make_interview_candidate(job_id)
    h1, h2 = login(client, e1, "pw-123456"), login(client, e2, "pw-123456")
    assert client.post("/api/interviews/book", json={"application_id": app1, "slot_id": slot_a}, headers=h1).status_code == 200
    assert client.post("/api/interviews/book", json={"application_id": app2, "slot_id": slot_b}, headers=h2).status_code == 200

    r = client.post("/api/interviews/change-time", json={"application_id": app1, "new_slot_id": slot_b}, headers=h1)
    assert r.status_code == 409
    db = SessionLocal()
    try:
        a = db.query(InterviewSlot).filter(InterviewSlot.id == slot_a).one()
        b = db.query(InterviewSlot).filter(InterviewSlot.id == slot_b).one()
        assert a.is_booked and a.booked_by_application_id == app1      # original kept
        assert b.is_booked and b.booked_by_application_id == app2      # untouched
    finally:
        db.close()


def test_candidate_not_in_interview_state_cannot_book(client, recruiter, student):
    job_id = active_job_id(client, recruiter)
    (slot_id,) = make_slots(client, recruiter, job_id, 1)
    email = uniq("early")
    uid = make_user(email)
    db = SessionLocal()
    app = Application(job_id=job_id, candidate_id=uid, resume_file_path="resumes/x.pdf",
                      original_filename="x.pdf", status=ApplicationState.IN_REVIEW)
    db.add(app)
    db.commit()
    app_id = app.id
    db.close()
    r = client.post("/api/interviews/book", json={"application_id": app_id, "slot_id": slot_id}, headers=login(client, email, "pw-123456"))
    assert r.status_code == 400
