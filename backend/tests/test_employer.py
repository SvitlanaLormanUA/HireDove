import pytest
from fastapi.testclient import TestClient

from app.models.user import User, UserRole
from app.models.vacancy import ExperienceLevel, Vacancy, VacancyStatus, WorkFormat


@pytest.fixture
def candidate_token(client):
    r = client.post(
        "/auth/register",
        json={
            "email": "candidate@example.com",
            "password": "candPassword1",
            "role": "candidate",
            "full_name": "Test Candidate",
        },
    )
    assert r.status_code == 201
    return r.json()["access_token"]


@pytest.fixture
def employer1_token(client):
    r = client.post(
        "/auth/register",
        json={
            "email": "employer1@example.com",
            "password": "empPassword1",
            "role": "employer",
            "full_name": "Employer One",
        },
    )
    assert r.status_code == 201
    return r.json()["access_token"]


@pytest.fixture
def employer2_token(client):
    r = client.post(
        "/auth/register",
        json={
            "email": "employer2@example.com",
            "password": "empPassword2",
            "role": "employer",
            "full_name": "Employer Two",
        },
    )
    assert r.status_code == 201
    return r.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Permissions & RBAC
# ---------------------------------------------------------------------------


def test_candidate_cannot_access_employer_routes(client, candidate_token):
    h = auth_header(candidate_token)
    assert client.get("/employer/profile", headers=h).status_code == 403
    assert client.get("/employer/vacancies", headers=h).status_code == 403
    assert client.post("/employer/vacancies", json={}, headers=h).status_code == 403


def test_anonymous_cannot_access_employer_routes(client):
    assert client.get("/employer/profile").status_code == 401
    assert client.get("/employer/vacancies").status_code == 401


# ---------------------------------------------------------------------------
# Company Profile CRUD
# ---------------------------------------------------------------------------


def test_company_profile_crud(client, employer1_token):
    h = auth_header(employer1_token)

    # 1. Profile initially not found
    r = client.get("/employer/profile", headers=h)
    assert r.status_code == 404

    # 2. Create profile
    payload = {
        "company_name": "SoftServe",
        "tagline": "Empowering Open Minds",
        "description": "Global IT company with deep Ukrainian roots.",
        "website": "https://softserveinc.com",
        "location": "Львів",
        "industry": "IT",
        "company_size": "1000+",
        "email": "jobs@softserveinc.com",
        "phone": "+380322409000",
    }
    r = client.put("/employer/profile", json=payload, headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["company_name"] == "SoftServe"
    assert data["tagline"] == "Empowering Open Minds"
    assert data["location"] == "Львів"

    # 3. Get profile
    r = client.get("/employer/profile", headers=h)
    assert r.status_code == 200
    assert r.json()["company_name"] == "SoftServe"

    # 4. Partial update (PATCH)
    r = client.patch("/employer/profile", json={"tagline": "Transforming the future"}, headers=h)
    assert r.status_code == 200
    assert r.json()["tagline"] == "Transforming the future"
    assert r.json()["company_name"] == "SoftServe"


def test_company_profile_validation(client, employer1_token):
    h = auth_header(employer1_token)
    # Empty or whitespace company_name is rejected
    r = client.put("/employer/profile", json={"company_name": "  "}, headers=h)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Vacancies CRUD & Server Validation
# ---------------------------------------------------------------------------


def test_create_vacancy_validation(client, employer1_token):
    h = auth_header(employer1_token)

    # Missing mandatory fields
    r = client.post("/employer/vacancies", json={}, headers=h)
    assert r.status_code == 422

    # Title too short (< 3 chars)
    bad_payload = {
        "title": "AB",
        "company_name": "SoftServe",
        "description": "Valid description with sufficient length for test",
        "location": "Київ",
        "work_format": "remote",
        "experience": "junior",
        "industry": "IT",
    }
    r = client.post("/employer/vacancies", json=bad_payload, headers=h)
    assert r.status_code == 422

    # Description too short (< 20 chars)
    bad_payload["title"] = "Junior Python Dev"
    bad_payload["description"] = "Too short"
    r = client.post("/employer/vacancies", json=bad_payload, headers=h)
    assert r.status_code == 422

    # Invalid work_format enum
    bad_payload["description"] = "A solid description that easily exceeds twenty characters."
    bad_payload["work_format"] = "space_station"
    r = client.post("/employer/vacancies", json=bad_payload, headers=h)
    assert r.status_code == 422


def test_create_and_manage_vacancies(client, employer1_token, employer2_token):
    h1 = auth_header(employer1_token)
    h2 = auth_header(employer2_token)

    # Initially employer 1 has 0 vacancies
    r = client.get("/employer/vacancies", headers=h1)
    assert r.status_code == 200
    assert r.json() == {"items": [], "total": 0, "active_count": 0, "closed_count": 0}

    # 1. Create vacancy
    valid_payload = {
        "title": "Junior Python Developer",
        "company_name": "SoftServe",
        "description": "We are seeking a motivated junior python developer with passion for clean code.",
        "location": "Київ",
        "work_format": "remote",
        "experience": "junior",
        "industry": "IT",
        "status": "active",
    }
    r = client.post("/employer/vacancies", json=valid_payload, headers=h1)
    assert r.status_code == 201
    created = r.json()
    v_id = created["id"]
    assert created["title"] == "Junior Python Developer"
    assert created["status"] == "active"

    # 2. Listed in employer1's vacancies
    r = client.get("/employer/vacancies", headers=h1)
    assert r.status_code == 200
    res = r.json()
    assert res["total"] == 1
    assert res["active_count"] == 1
    assert res["closed_count"] == 0
    assert res["items"][0]["id"] == v_id

    # 3. Employer2 sees 0 vacancies in their dashboard
    r = client.get("/employer/vacancies", headers=h2)
    assert r.status_code == 200
    assert r.json()["total"] == 0

    # 4. Employer2 cannot edit or delete employer1's vacancy
    assert client.put(f"/employer/vacancies/{v_id}", json={"title": "Hacked"}, headers=h2).status_code == 403
    assert client.delete(f"/employer/vacancies/{v_id}", headers=h2).status_code == 403
    assert client.patch(f"/employer/vacancies/{v_id}/status", json={"status": "closed"}, headers=h2).status_code == 403

    # 5. Employer1 can edit their vacancy
    r = client.put(
        f"/employer/vacancies/{v_id}",
        json={"title": "Middle Python Developer", "location": "Львів"},
        headers=h1,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Middle Python Developer"
    assert r.json()["location"] == "Львів"

    # 6. Change status (PATCH /status)
    r = client.patch(
        f"/employer/vacancies/{v_id}/status",
        json={"status": "closed"},
        headers=h1,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    # Check stats update
    r = client.get("/employer/vacancies", headers=h1)
    assert r.json()["active_count"] == 0
    assert r.json()["closed_count"] == 1

    # Filter by status
    r_act = client.get("/employer/vacancies?status=active", headers=h1)
    assert len(r_act.json()["items"]) == 0
    r_cls = client.get("/employer/vacancies?status=closed", headers=h1)
    assert len(r_cls.json()["items"]) == 1

    # 7. Public detail view
    r = client.get(f"/vacancies/{v_id}")
    assert r.status_code == 200
    assert r.json()["id"] == v_id

    # 8. Delete vacancy
    r = client.delete(f"/employer/vacancies/{v_id}", headers=h1)
    assert r.status_code == 204

    # Now it's gone
    assert client.get(f"/employer/vacancies/{v_id}", headers=h1).status_code == 404
    assert client.get(f"/vacancies/{v_id}").status_code == 404


def test_employer_cannot_apply_to_vacancies(client, employer1_token, candidate_token):
    h_emp = auth_header(employer1_token)
    h_cand = auth_header(candidate_token)

    # Employer creates an active vacancy
    payload = {
        "title": "React Developer",
        "company_name": "Tech Co",
        "description": "Building modern frontend applications with TypeScript and React.",
        "location": "Київ",
        "work_format": "remote",
        "experience": "junior",
        "industry": "IT",
        "status": "active",
    }
    r = client.post("/employer/vacancies", json=payload, headers=h_emp)
    assert r.status_code == 201
    v_id = r.json()["id"]

    # Employer attempts to apply -> 403 Forbidden
    r_emp_apply = client.post(f"/vacancies/{v_id}/apply", headers=h_emp)
    assert r_emp_apply.status_code == 403
    assert "Роботодавці не можуть відгукуватися" in r_emp_apply.json()["detail"]

    # Candidate attempts to apply -> 200 OK
    r_cand_apply = client.post(f"/vacancies/{v_id}/apply", headers=h_cand)
    assert r_cand_apply.status_code == 200
    assert r_cand_apply.json()["status"] == "ok"


def test_employer_vacancy_bound_to_company_profile(client, employer1_token):
    h = auth_header(employer1_token)

    # Save company profile
    client.put("/employer/profile", json={"company_name": "Verified Acme Corp"}, headers=h)

    # Post vacancy with different company name
    payload = {
        "title": "Golang Backend Developer",
        "company_name": "Fake Name",
        "description": "High performance microservices architecture in Go and Docker.",
        "location": "Дніпро",
        "work_format": "office",
        "experience": "middle",
        "industry": "IT",
    }
    r = client.post("/employer/vacancies", json=payload, headers=h)
    assert r.status_code == 201
    assert r.json()["company_name"] == "Verified Acme Corp"
