from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.main import app
from app.models.user import User, UserRole

# A throwaway route to exercise RBAC.
_rbac_router = APIRouter()


@_rbac_router.get("/_test/employer-only")
def employer_only(user: Annotated[User, Depends(require_roles(UserRole.employer))]):
    return {"ok": True}


app.include_router(_rbac_router)


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_returns_token_and_user(register):
    r = register()
    assert r.status_code == 201
    body = r.json()
    assert body["access_token"]
    assert body["user"]["email"] == "cand@example.com"
    assert body["user"]["role"] == "candidate"
    assert "hashed_password" not in body["user"]


def test_password_is_stored_hashed(register, db_session):
    register()
    user = db_session.query(User).one()
    assert user.hashed_password != "secret123"
    assert user.hashed_password.startswith("$2")


def test_cannot_register_as_admin(register):
    assert register(role="admin").status_code == 422


def test_duplicate_email_rejected_case_insensitive(register):
    register()
    assert register(email="CAND@example.com").status_code == 409


def test_weak_password_rejected(register):
    assert register(password="short1").status_code == 422
    assert register(password="onlyletters").status_code == 422


def test_invalid_email_rejected(register):
    assert register(email="not-an-email").status_code == 422


def test_login_success(client, register):
    register()
    r = client.post("/auth/login", json={"email": "cand@example.com", "password": "secret123"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_login_wrong_password(client, register):
    register()
    r = client.post("/auth/login", json={"email": "cand@example.com", "password": "wrong1234"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"


def test_login_unknown_email_same_error(client):
    r = client.post("/auth/login", json={"email": "nobody@example.com", "password": "secret123"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"


def test_account_locked_after_5_failures(client, register):
    from app.api.routes.auth import ip_limiter

    register()
    for _ in range(5):
        client.post("/auth/login", json={"email": "cand@example.com", "password": "wrong1234"})
        ip_limiter._hits.clear()  # isolate the per-account lock from the per-IP one
    r = client.post("/auth/login", json={"email": "cand@example.com", "password": "secret123"})
    assert r.status_code == 429


def test_ip_blocked_after_5_failures(client):
    for i in range(5):
        client.post("/auth/login", json={"email": f"x{i}@example.com", "password": "wrong1234"})
    r = client.post("/auth/login", json={"email": "x9@example.com", "password": "wrong1234"})
    assert r.status_code == 429


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=auth_header("garbage")).status_code == 401


def test_me_returns_current_user(client, register):
    token = register().json()["access_token"]
    r = client.get("/auth/me", headers=auth_header(token))
    assert r.status_code == 200
    assert r.json()["email"] == "cand@example.com"


def test_logout_all_invalidates_existing_tokens(client, register):
    token = register().json()["access_token"]
    assert client.post("/auth/logout-all", headers=auth_header(token)).status_code == 204
    assert client.get("/auth/me", headers=auth_header(token)).status_code == 401


def test_blocked_user_loses_access(client, register, db_session):
    token = register().json()["access_token"]
    user = db_session.query(User).one()
    user.is_active = False
    db_session.commit()

    assert client.get("/auth/me", headers=auth_header(token)).status_code == 403
    r = client.post("/auth/login", json={"email": "cand@example.com", "password": "secret123"})
    assert r.status_code == 403


def test_rbac_blocks_wrong_role(client, register):
    cand = register().json()["access_token"]
    emp = register(email="emp@example.com", role="employer").json()["access_token"]
    assert client.get("/_test/employer-only", headers=auth_header(cand)).status_code == 403
    assert client.get("/_test/employer-only", headers=auth_header(emp)).status_code == 200
