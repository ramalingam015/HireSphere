import pytest


def login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_login_rejects_invalid_password(client):
    response = login(client, "student@university.edu", "wrong-password")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"
    assert "access_token" not in response.json()


def test_login_rejects_unknown_user(client):
    response = login(client, "nobody@example.com", "student123")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"
    assert "access_token" not in response.json()


def test_login_accepts_valid_demo_candidate(client):
    response = login(client, "student@university.edu", "student123")
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "student@university.edu"
    assert body["user"]["role"] == "candidate"


@pytest.mark.parametrize(
    "email,password,role",
    [
        ("admin@recruit.com", "admin123", "admin"),
        ("recruiter@techcorp.com", "recruiter123", "recruiter"),
        ("pending@startup.io", "pending123", "recruiter"),
    ],
)
def test_login_accepts_legitimate_demo_accounts(client, email, password, role):
    response = login(client, email, password)
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == email
    assert body["user"]["role"] == role
    assert body["access_token"]
