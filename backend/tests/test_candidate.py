from io import BytesIO

from PIL import Image
import pytest
from sqlalchemy import func, select

from app.models.candidate import CandidateProfile, Resume, SavedVacancy
from app.models.user import User
from app.models.vacancy import Vacancy, VacancyStatus, WorkFormat, ExperienceLevel


@pytest.fixture
def candidate_headers(register):
    return {"Authorization": "Bearer " + register().json()["access_token"]}


@pytest.fixture
def other_headers(register):
    return {"Authorization": "Bearer " + register(email="other@example.com").json()["access_token"]}


@pytest.fixture
def vacancies(db_session, register):
    employer = register(email="owner@example.com", role="employer").json()["user"]
    items = [Vacancy(employer_id=employer["id"], title=f"Junior developer {i}", company_name="Demo", description="A development internship for students.", location="Kyiv", work_format=WorkFormat.remote, experience=ExperienceLevel.none, industry="IT", status=VacancyStatus.active) for i in range(3)]
    db_session.add_all(items)
    db_session.commit()
    return items


def test_profile_crud_persists_after_login(client, candidate_headers, db_session):
    assert client.get('/candidate/profile', headers=candidate_headers).status_code == 404
    payload = {"full_name": "Sofia Candidate", "location": "Kyiv", "skills": "Python", "education": "University"}
    response = client.post('/candidate/profile', headers=candidate_headers, json=payload)
    assert response.status_code == 200
    assert response.json()["email"] == "cand@example.com"
    assert client.get('/candidate/profile', headers=candidate_headers).json()["location"] == "Kyiv"
    payload.update(full_name="Sofia Updated", location="Lviv")
    assert client.put('/candidate/profile', headers=candidate_headers, json=payload).status_code == 200
    client.post('/auth/logout', headers=candidate_headers)
    token = client.post('/auth/login', json={"email": "cand@example.com", "password": "secret123"}).json()["access_token"]
    assert client.get('/candidate/profile', headers={"Authorization": f"Bearer {token}"}).json()["location"] == "Lviv"
    assert client.get('/auth/me', headers=candidate_headers).json()["full_name"] == "Sofia Updated"
    assert db_session.scalar(select(func.count()).select_from(CandidateProfile)) == 1
    assert client.delete('/candidate/profile', headers=candidate_headers).status_code == 204
    assert client.get('/candidate/profile', headers=candidate_headers).status_code == 404
    assert client.get('/auth/me', headers=candidate_headers).status_code == 200


def test_resume_crud_without_experience(client, candidate_headers, db_session):
    data = {"title": "Junior developer", "education": [{"name": "University", "detail": "Computer Science"}], "skills": ["Python"]}
    assert client.get('/candidate/resume', headers=candidate_headers).status_code == 404
    assert client.put('/candidate/resume', headers=candidate_headers, json=data).status_code == 404
    response = client.post('/candidate/resume', headers=candidate_headers, json=data)
    assert response.status_code == 201
    assert response.json()["experience"] == []
    resume_id = response.json()["id"]
    assert client.post('/candidate/resume', headers=candidate_headers, json=data).status_code == 409
    data.update(title="Junior Python developer", projects=[{"name": "Campus app", "description": "Student project"}])
    assert client.put('/candidate/resume', headers=candidate_headers, json=data).json()["id"] == resume_id
    assert client.get('/candidate/resume', headers=candidate_headers).json()["projects"][0]["name"] == "Campus app"
    assert db_session.scalar(select(func.count()).select_from(Resume)) == 1
    assert client.delete('/candidate/resume', headers=candidate_headers).status_code == 204
    assert client.get('/candidate/resume', headers=candidate_headers).status_code == 404
    assert client.delete('/candidate/resume', headers=candidate_headers).status_code == 404


@pytest.mark.parametrize('payload', [{}, {"title": "  "}, {"title": "x" * 256}, {"title": "Junior", "experience": None}, {"title": "Junior", "education": [{"name": " "}]}, {"title": "Junior", "skills": ["x" * 121]}, {"title": "Junior", "languages": ["English"] * 51}, {"title": "Junior", "user_id": 123}])
def test_resume_validation(client, candidate_headers, payload):
    assert client.post('/candidate/resume', headers=candidate_headers, json=payload).status_code == 422


def test_private_data_and_mass_assignment(client, candidate_headers, other_headers, db_session):
    client.put('/candidate/profile', headers=candidate_headers, json={"full_name": "Owner Candidate", "description": "private"})
    client.post('/candidate/resume', headers=candidate_headers, json={"title": "Private resume"})
    for resource in ('profile', 'resume'):
        assert client.get(f'/candidate/{resource}', headers=other_headers).status_code == 404
        assert client.delete(f'/candidate/{resource}', headers=other_headers).status_code == 404
    assert client.put('/candidate/resume', headers=other_headers, json={"title": "Stolen resume"}).status_code == 404
    assert client.put('/candidate/profile', headers=other_headers, json={"full_name": "Other", "user_id": 1}).status_code == 422
    assert client.get('/candidate/profile', headers=candidate_headers).json()["description"] == "private"
    assert client.get('/candidate/resume', headers=candidate_headers).json()["title"] == "Private resume"


ENDPOINTS = [('GET', '/profile'), ('PUT', '/profile'), ('POST', '/profile'), ('DELETE', '/profile'), ('GET', '/resume'), ('POST', '/resume'), ('PUT', '/resume'), ('DELETE', '/resume'), ('POST', '/profile/avatar'), ('GET', '/profile/avatar'), ('DELETE', '/profile/avatar'), ('GET', '/saved-vacancies'), ('PUT', '/saved-vacancies/1'), ('DELETE', '/saved-vacancies/1')]


@pytest.mark.parametrize('method,path', ENDPOINTS)
def test_unauthenticated(client, method, path):
    assert client.request(method, '/candidate' + path).status_code == 401


@pytest.mark.parametrize('method,path', ENDPOINTS)
def test_employer_rejected(client, register, method, path):
    token = register(role="employer").json()["access_token"]
    assert client.request(method, '/candidate' + path, headers={"Authorization": "Bearer " + token}).status_code == 403


def test_favorites_isolated_idempotent_and_catalog_unchanged(client, candidate_headers, other_headers, vacancies, db_session):
    a, b, c = vacancies
    for _ in range(2):
        assert client.put(f'/candidate/saved-vacancies/{a.id}', headers=candidate_headers).status_code == 204
    client.put(f'/candidate/saved-vacancies/{b.id}', headers=other_headers)
    assert db_session.scalar(select(func.count()).select_from(SavedVacancy)) == 2
    assert [v['id'] for v in client.get('/candidate/saved-vacancies', headers=candidate_headers).json()] == [a.id]
    assert [v['id'] for v in client.get('/candidate/saved-vacancies', headers=other_headers).json()] == [b.id]
    assert client.delete(f'/candidate/saved-vacancies/{a.id}', headers=other_headers).status_code == 204
    assert len(client.get('/candidate/saved-vacancies', headers=candidate_headers).json()) == 1
    for _ in range(2):
        assert client.delete(f'/candidate/saved-vacancies/{a.id}', headers=candidate_headers).status_code == 204
    assert client.get('/candidate/saved-vacancies', headers=candidate_headers).json() == []
    assert client.get('/vacancies/search').json()['total'] == 3
    assert client.put('/candidate/saved-vacancies/99999', headers=candidate_headers).status_code == 404
    a.is_hidden = True
    c.status = VacancyStatus.closed
    db_session.commit()
    for v in (a, c):
        assert client.put(f'/candidate/saved-vacancies/{v.id}', headers=candidate_headers).status_code == 404
    b.is_hidden = True
    db_session.commit()
    assert client.get('/candidate/saved-vacancies', headers=other_headers).json() == []


def test_avatar_conversion_validation_and_ownership(client, candidate_headers, other_headers):
    client.put('/candidate/profile', headers=candidate_headers, json={"full_name": "Test Candidate"})
    source = BytesIO()
    Image.new('RGB', (800, 600), 'red').save(source, format='PNG')
    response = client.post('/candidate/profile/avatar', headers=candidate_headers, files={"file": ("../../test.png", source.getvalue(), 'image/png')})
    assert response.status_code == 200
    assert response.json()['has_avatar'] is True
    avatar = client.get('/candidate/profile/avatar', headers=candidate_headers)
    assert avatar.headers['content-type'] == 'image/webp'
    with Image.open(BytesIO(avatar.content)) as result:
        assert result.format == 'WEBP'
        assert max(result.size) == 512
    assert client.get('/candidate/profile/avatar', headers=other_headers).status_code == 404
    assert client.post('/candidate/profile/avatar', headers=candidate_headers, files={"file": ('fake.png', b'<script>alert(1)</script>', 'image/png')}).status_code == 422
    assert client.post('/candidate/profile/avatar', headers=candidate_headers, files={"file": ('huge.png', b'x' * (5 * 1024 * 1024 + 1), 'image/png')}).status_code == 413
    assert client.delete('/candidate/profile/avatar', headers=candidate_headers).status_code == 204
    assert client.get('/candidate/profile/avatar', headers=candidate_headers).status_code == 404


def test_seed_idempotent(db_session, vacancies):
    from app.seed_candidate import seed, DEMO_EMAIL
    assert seed(db_session) == 2
    assert seed(db_session) == 2
    assert db_session.scalar(select(func.count()).select_from(User).where(User.email == DEMO_EMAIL)) == 1
    assert db_session.scalar(select(func.count()).select_from(CandidateProfile)) == 1
    assert db_session.scalar(select(func.count()).select_from(Resume)) == 1
    assert db_session.scalar(select(func.count()).select_from(SavedVacancy)) == 2


@pytest.mark.parametrize('payload', [{"full_name": " "}, {"full_name": "Test", "phone": "x" * 51}, {"full_name": "Test", "description": "x" * 5001}, {"full_name": "Test", "location": None}])
def test_profile_validation(client, candidate_headers, payload):
    assert client.put('/candidate/profile', headers=candidate_headers, json=payload).status_code == 422


def test_profile_delete_preserves_resume(client, candidate_headers):
    client.put('/candidate/profile', headers=candidate_headers, json={"full_name": "Test Candidate"})
    client.post('/candidate/resume', headers=candidate_headers, json={"title": "Student resume"})
    client.delete('/candidate/profile', headers=candidate_headers)
    assert client.get('/candidate/resume', headers=candidate_headers).json()['title'] == 'Student resume'


def test_blocked_candidate_and_admin_rejected(client, candidate_headers, db_session):
    from app.models.user import UserRole

    user = db_session.scalar(select(User))
    user.is_active = False
    db_session.commit()
    assert client.get('/candidate/resume', headers=candidate_headers).status_code == 403
    user.is_active = True
    user.role = UserRole.admin
    db_session.commit()
    assert client.get('/candidate/profile', headers=candidate_headers).status_code == 403


def test_seed_rejects_production(db_session, monkeypatch):
    from types import SimpleNamespace
    from app.seed_candidate import seed

    monkeypatch.setattr('app.seed_candidate.get_settings', lambda: SimpleNamespace(environment='production'))
    with pytest.raises(RuntimeError, match='only in development'):
        seed(db_session)
    assert db_session.scalar(select(func.count()).select_from(User)) == 0


def test_employer_can_delete_saved_vacancy(client, candidate_headers, vacancies, db_session):
    vacancy = vacancies[0]
    client.put(f'/candidate/saved-vacancies/{vacancy.id}', headers=candidate_headers)
    token = client.post('/auth/login', json={"email": "owner@example.com", "password": "secret123"}).json()['access_token']
    assert client.delete(f'/employer/vacancies/{vacancy.id}', headers={"Authorization": "Bearer " + token}).status_code == 204
    db_session.expire_all()
    assert db_session.scalar(select(func.count()).select_from(SavedVacancy)) == 0
    assert client.get('/candidate/saved-vacancies', headers=candidate_headers).json() == []
