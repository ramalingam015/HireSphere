"""Email verification flow and delivery providers (all network/SMTP mocked)."""
import uuid
from datetime import datetime, timedelta

import pytest

from app import config, email_service
from app.auth import create_access_token
from app.database import SessionLocal
from app.models import User
from app.routes import auth_routes


@pytest.fixture
def sent(monkeypatch):
    """Capture verification emails instead of sending them."""
    box = []

    def fake(email, code, name=""):
        box.append((email, code))
        return True, "sent"
    monkeypatch.setattr(auth_routes, "send_verification_email", fake)
    return box


def register(client, **extra):
    email = f"u{uuid.uuid4().hex[:10]}@example.com"
    r = client.post("/api/auth/register", json={
        "email": email, "password": "pw-123456", "full_name": "New User", "role": "candidate", **extra})
    assert r.status_code == 200, r.text
    return email, r.json()


def set_db(email, **fields):
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        for k, v in fields.items():
            setattr(u, k, v)
        db.commit()
    finally:
        db.close()


# ---- verification flow ----------------------------------------------------
def test_register_issues_no_token_and_emails_a_code(client, sent):
    email, body = register(client)
    assert body["access_token"] is None
    assert sent[-1][0] == email and len(sent[-1][1]) == 6 and sent[-1][1].isdigit()


def test_unverified_user_cannot_login_or_use_api(client, sent):
    email, _ = register(client)
    assert client.post("/api/auth/login", json={"email": email, "password": "pw-123456"}).status_code == 403
    # even a validly signed token for the unverified account is refused
    db = SessionLocal()
    uid = db.query(User).filter(User.email == email).first().id
    db.close()
    token = create_access_token({"sub": str(uid), "role": "candidate"})
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_verify_with_correct_code_issues_token(client, sent):
    email, _ = register(client)
    code = sent[-1][1]
    r = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert r.status_code == 200 and r.json()["is_verified"] is True
    token = r.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_wrong_codes_are_limited_then_code_is_invalidated(client, sent):
    email, _ = register(client)
    good = sent[-1][1]
    bad = "000000" if good != "000000" else "111111"
    for _ in range(4):
        assert client.post("/api/auth/verify-email", json={"email": email, "code": bad}).status_code == 400
    assert client.post("/api/auth/verify-email", json={"email": email, "code": bad}).status_code == 429
    # the right code no longer works: a new one must be requested
    assert client.post("/api/auth/verify-email", json={"email": email, "code": good}).status_code == 400


def test_expired_code_rejected(client, sent):
    email, _ = register(client)
    set_db(email, email_verification_expiry=datetime.utcnow() - timedelta(minutes=1))
    r = client.post("/api/auth/verify-email", json={"email": email, "code": sent[-1][1]})
    assert r.status_code == 400 and "expired" in r.json()["detail"].lower()


def test_resend_has_a_cooldown_then_issues_new_code(client, sent):
    email, _ = register(client)
    assert client.post("/api/auth/resend-verification", json={"email": email}).status_code == 429
    # pretend the first code was issued 2 minutes ago
    set_db(email, email_verification_expiry=datetime.utcnow() + timedelta(hours=24) - timedelta(minutes=2))
    r = client.post("/api/auth/resend-verification", json={"email": email})
    assert r.status_code == 200 and len(sent) == 2


def test_runtime_email_configuration_endpoint_is_gone(client, admin):
    assert client.post("/api/auth/configure-email", json={}, headers=admin).status_code in (404, 405)


# ---- code logging ----------------------------------------------------------
def test_code_is_logged_in_dev_but_never_in_production(monkeypatch, capsys):
    for k in ("BREVO_API_KEY", "RESEND_API_KEY", "SENDGRID_API_KEY", "SMTP_USER", "SMTP_PASSWORD"):
        monkeypatch.setattr(config, k, "")
    monkeypatch.setattr(config, "APP_ENV", "development")
    ok, detail = email_service.send_verification_email("a@b.co", "123456", "A")
    assert ok is False and "not configured" in detail
    assert "123456" in capsys.readouterr().out

    monkeypatch.setattr(config, "APP_ENV", "production")
    email_service.send_verification_email("a@b.co", "654321", "A")
    assert "654321" not in capsys.readouterr().out


# ---- providers --------------------------------------------------------------
class R:
    def __init__(self, status=200, body=None):
        self.status_code, self._b, self.text = status, body or {}, str(body or "")
        self.headers = {"content-type": "application/json"}

    def json(self):
        return self._b


@pytest.fixture
def providers_off(monkeypatch):
    for k in ("BREVO_API_KEY", "RESEND_API_KEY", "SENDGRID_API_KEY", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"):
        monkeypatch.setattr(config, k, "")
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.com")


def test_unconfigured_status_and_message(providers_off):
    assert email_service.get_email_service_status()["configured"] is False
    ok, detail = email_service.send_verification_email("a@b.co", "123456")
    assert not ok and "backend/.env" in detail


@pytest.mark.parametrize("key_attr,key,url_part,provider", [
    ("RESEND_API_KEY", "re_test", "api.resend.com", "Resend"),
    ("SENDGRID_API_KEY", "SG.test", "api.sendgrid.com", "SendGrid"),
    ("BREVO_API_KEY", "xkeysib-test", "api.brevo.com", "Brevo"),
])
def test_http_api_providers_success(monkeypatch, providers_off, key_attr, key, url_part, provider):
    monkeypatch.setattr(config, key_attr, key)
    monkeypatch.setattr(config, "SMTP_FROM_EMAIL", "sender@example.com")
    seen = []
    monkeypatch.setattr(email_service.requests, "post", lambda url, **kw: seen.append((url, kw)) or R(202 if provider == "SendGrid" else 200, {}))
    ok, detail = email_service.send_verification_email("to@example.com", "123456", "Pat")
    assert ok and provider in detail
    assert url_part in seen[0][0]
    assert "123456" in str(seen[0][1]["json"])  # the code is in the message body
    assert "to@example.com" in str(seen[0][1]["json"])


def test_provider_error_is_reported_not_raised(monkeypatch, providers_off):
    monkeypatch.setattr(config, "BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setattr(email_service.requests, "post", lambda url, **kw: R(401, {"message": "Key not found"}))
    ok, detail = email_service.send_verification_email("to@example.com", "123456")
    assert not ok and "Brevo" in detail


def test_gmail_smtp_ssl_path(monkeypatch, providers_off):
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setattr(config, "SMTP_USER", "me@gmail.com")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "abcdabcdabcdabcd")
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            calls.append(("connect", host, port))

        def login(self, u, p):
            calls.append(("login", u))

        def sendmail(self, frm, to, msg):
            calls.append(("sendmail", to))

        def send_message(self, msg, *a, **k):
            calls.append(("sendmail", msg["To"]))

        def quit(self):
            calls.append(("quit",))

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", FakeSMTP)
    ok, detail = email_service.send_verification_email("to@example.com", "123456")
    assert ok and "Gmail" in detail
    assert ("connect", "smtp.gmail.com", 465) in calls and ("login", "me@gmail.com") in calls


# ---- what end users may see --------------------------------------------------
def test_end_users_get_a_generic_message_in_production_but_admins_see_detail(client, admin, monkeypatch, capsys):
    monkeypatch.setattr(auth_routes, "send_verification_email",
                        lambda e, c, n="": (False, "Brevo 401: key sk-secret-123 not found; set BREVO_API_KEY in backend/.env"))
    monkeypatch.setattr(config, "APP_ENV", "production")
    email = f"u{uuid.uuid4().hex[:10]}@example.com"
    body = client.post("/api/auth/register", json={"email": email, "password": "pw-123456", "full_name": "X", "role": "candidate"}).json()
    shown = str(body["email_detail"]) + str(body["message"])
    assert "secret" not in shown and "backend/.env" not in shown and "try again" in shown.lower()

    monkeypatch.setattr(config, "APP_ENV", "development")
    email2 = f"u{uuid.uuid4().hex[:10]}@example.com"
    dev = client.post("/api/auth/register", json={"email": email2, "password": "pw-123456", "full_name": "X", "role": "candidate"}).json()
    assert "backend/.env" in dev["email_detail"]  # developers still get the real reason
