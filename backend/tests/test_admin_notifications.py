from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import BackgroundTasks
from sqlalchemy import func, select

from app.core.security import create_access_token
from app.core.config import Settings
from app.models.administration import AuditRecord, Notification
from app.models.candidate import Resume, SavedVacancy
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy, VacancyStatus
from app.services.administration import moderate
from app.services.notifications import create_notification


@pytest.fixture
def actors(db_session, register):
    result = {}
    for role in ('candidate', 'employer'):
        response = register(email=f'{role}@example.com', role=role)
        result[role] = (response.json()['user']['id'], {'Authorization': 'Bearer ' + response.json()['access_token']})
    admin = User(email='admin@example.com', hashed_password='unused', full_name='Admin', role=UserRole.admin)
    db_session.add(admin)
    db_session.commit()
    result['admin'] = (admin.id, {'Authorization': 'Bearer ' + create_access_token(admin.id, 'admin', 0)})
    return result


@pytest.fixture
def vacancy(client, actors):
    response = client.post('/employer/vacancies', headers=actors['employer'][1], json={
        'title': 'Junior Python developer', 'company_name': 'Fictional company',
        'description': 'A fictional position for a junior Python developer.',
        'location': 'Kyiv', 'industry': 'IT', 'experience': 'junior', 'work_format': 'remote',
    })
    assert response.status_code == 201
    return response.json()['id']


ADMIN_ENDPOINTS = [('GET', '/users'), ('GET', '/vacancies'), ('GET', '/vacancies/1'), ('GET', '/audit'),
                   ('PATCH', '/users/1/block'), ('PATCH', '/users/1/unblock'),
                   ('PATCH', '/vacancies/1/hide'), ('PATCH', '/vacancies/1/restore')]


@pytest.mark.parametrize('method,path', ADMIN_ENDPOINTS)
@pytest.mark.parametrize('role', ['candidate', 'employer', None])
def test_admin_rbac(client, actors, method, path, role):
    headers = actors[role][1] if role else {}
    assert client.request(method, '/admin' + path, headers=headers, json={'reason': 'Platform rules'}).status_code == (403 if role else 401)


def test_admin_lists_filters_pagination_and_privacy(client, actors, vacancy):
    headers = actors['admin'][1]
    result = client.get('/admin/users?page_size=1', headers=headers).json()
    assert result['total'] == 3 and result['pages'] == 3 and len(result['items']) == 1
    assert set(result['items'][0]) == {'id', 'full_name', 'role', 'is_active', 'created_at'}
    assert client.get('/admin/users?role=employer&is_active=true', headers=headers).json()['total'] == 1
    assert client.get('/admin/users?q=not-found', headers=headers).json()['total'] == 0
    assert client.get('/admin/users?q=%25', headers=headers).json()['total'] == 0
    assert client.get('/admin/vacancies?is_hidden=false&status=active', headers=headers).json()['items'][0]['id'] == vacancy
    assert client.get(f'/admin/vacancies/{vacancy}', headers=headers).status_code == 200
    assert client.get('/admin/audit', headers=headers).json()['items'] == []
    for path in ['/admin/users?page=0', '/admin/vacancies?page_size=101', '/admin/audit?action=delete_everything']:
        assert client.get(path, headers=headers).status_code == 422


@pytest.mark.parametrize('role', ['candidate', 'employer'])
def test_block_unblock_immediate_access_and_no_duplicates(client, actors, db_session, role, monkeypatch):
    sender = Mock(return_value=True)
    monkeypatch.setattr('app.services.administration.send_email', sender)
    uid, headers = actors[role]
    admin_headers = actors['admin'][1]
    for _ in range(2):
        result = client.patch(f'/admin/users/{uid}/block', headers=admin_headers, json={'reason': 'Platform rules violation'})
        assert result.status_code == 200 and result.json()['is_active'] is False
    assert client.get('/auth/me', headers=headers).status_code == 403
    assert client.get('/notifications', headers=headers).status_code == 403
    assert client.post('/auth/login', json={'email': f'{role}@example.com', 'password': 'secret123'}).status_code == 403
    assert sender.call_count == 1
    for _ in range(2):
        assert client.patch(f'/admin/users/{uid}/unblock', headers=admin_headers, json={'reason': 'Review complete'}).status_code == 200
    assert client.get('/auth/me', headers=headers).status_code == 200
    assert sender.call_count == 2
    records = db_session.scalars(select(AuditRecord).order_by(AuditRecord.id)).all()
    assert [(r.action, r.admin_id, r.target_type, r.target_id) for r in records] == [
        ('block_user', actors['admin'][0], 'user', uid), ('unblock_user', actors['admin'][0], 'user', uid)]
    assert all(r.created_at and r.reason for r in records)
    assert db_session.scalar(select(func.count()).select_from(Notification)) == 2
    assert client.get(f'/admin/audit?action=block_user&target_id={uid}&target_type=user&admin_id={actors["admin"][0]}', headers=admin_headers).json()['total'] == 1


def test_admin_accounts_and_validation_protected(client, actors, db_session):
    other = User(email='other-admin@example.com', hashed_password='unused', full_name='Other', role=UserRole.admin)
    db_session.add(other); db_session.commit()
    for uid in (actors['admin'][0], other.id):
        for action in ('block', 'unblock'):
            assert client.patch(f'/admin/users/{uid}/{action}', headers=actors['admin'][1], json={'reason': 'Test reason'}).status_code == 403
    for body in ({}, {'reason': '  '}, {'reason': 'x' * 1001}, {'reason': 'Valid', 'role': 'admin'}):
        assert client.patch(f'/admin/users/{actors["candidate"][0]}/block', headers=actors['admin'][1], json=body).status_code == 422
    assert client.patch('/admin/users/999/block', headers=actors['admin'][1], json={'reason': 'Test reason'}).status_code == 404
    assert db_session.scalar(select(func.count()).select_from(AuditRecord)) == 0


@pytest.mark.parametrize('initial_status', ['active', 'closed'])
def test_hide_restore_preserves_lifecycle_history_and_prevents_bypass(client, actors, vacancy, db_session, initial_status):
    admin_headers = actors['admin'][1]
    employer_headers = actors['employer'][1]
    candidate_headers = actors['candidate'][1]
    # Existing relationships must survive both decisions.
    db_session.add(SavedVacancy(user_id=actors['candidate'][0], vacancy_id=vacancy))
    db_session.add(Resume(user_id=actors['candidate'][0], title='Private resume'))
    row = db_session.get(Vacancy, vacancy)
    row.status = VacancyStatus(initial_status)
    db_session.commit()
    for _ in range(2):
        result = client.patch(f'/admin/vacancies/{vacancy}/hide', headers=admin_headers, json={'reason': 'Misleading vacancy'})
        assert result.status_code == 200 and result.json()['is_hidden'] is True
    assert client.get('/vacancies/search').json()['total'] == 0
    assert client.get('/vacancies/filters').json() == {'locations': [], 'industries': []}
    assert client.get(f'/vacancies/{vacancy}').status_code == 404
    assert client.post(f'/vacancies/{vacancy}/apply', headers=candidate_headers).status_code == 404
    assert client.put(f'/candidate/saved-vacancies/{vacancy}', headers=candidate_headers).status_code == 404
    assert client.get('/candidate/saved-vacancies', headers=candidate_headers).json() == []
    assert client.get(f'/admin/vacancies/{vacancy}', headers=admin_headers).json()['is_hidden'] is True
    assert client.get('/admin/vacancies?is_hidden=true', headers=admin_headers).json()['total'] == 1
    opposite = 'closed' if initial_status == 'active' else 'active'
    assert client.patch(f'/employer/vacancies/{vacancy}/status', headers=employer_headers, json={'status': opposite}).status_code == 409
    assert client.put(f'/employer/vacancies/{vacancy}', headers=employer_headers, json={'status': opposite, 'is_hidden': False}).status_code == 409
    result = client.put(f'/employer/vacancies/{vacancy}', headers=employer_headers, json={'title': 'Corrected vacancy', 'is_hidden': False})
    assert result.status_code == 200 and result.json()['is_hidden'] is True
    for _ in range(2):
        result = client.patch(f'/admin/vacancies/{vacancy}/restore', headers=admin_headers, json={'reason': 'Review complete'})
        assert result.status_code == 200 and result.json()['is_hidden'] is False
        assert result.json()['status'] == initial_status
    assert client.get('/vacancies/search').json()['total'] == int(initial_status == 'active')
    assert db_session.get(SavedVacancy, (actors['candidate'][0], vacancy)) is not None
    assert db_session.scalar(select(func.count()).select_from(Resume)) == 1
    assert [r.action for r in db_session.scalars(select(AuditRecord).order_by(AuditRecord.id)).all()] == ['hide_vacancy', 'restore_vacancy']
    assert db_session.scalar(select(func.count()).select_from(Notification)) == 2
    # A new decision is a new event, even with the same reason.
    client.patch(f'/admin/vacancies/{vacancy}/hide', headers=admin_headers, json={'reason': 'Misleading vacancy'})
    assert db_session.scalar(select(func.count()).select_from(Notification)) == 3


def test_audit_append_only_and_survives_target_deletion(client, actors, vacancy, db_session):
    h = actors['admin'][1]
    client.patch(f'/admin/vacancies/{vacancy}/hide', headers=h, json={'reason': 'Rules violation'})
    assert client.delete(f'/employer/vacancies/{vacancy}', headers=actors['employer'][1]).status_code == 204
    assert client.get('/admin/audit', headers=h).json()['total'] == 1
    for method in ('POST', 'PATCH', 'DELETE'):
        assert client.request(method, '/admin/audit', headers=h, json={}).status_code == 405
    notification = db_session.scalar(select(Notification))
    assert notification.related_id == vacancy
    assert client.get('/notifications', headers=actors['employer'][1]).json()['total'] == 1


def test_notification_ownership_read_behaviour_and_deduplication(client, actors, db_session):
    uid, headers = actors['candidate']
    for _ in range(2):
        a = create_notification(db_session, recipient_id=uid, type='demo', title='Example', message='Example', event_key=f'test:{uid}')
    b = create_notification(db_session, recipient_id=actors['employer'][0], type='demo', title='Private', message='Private')
    db_session.commit()
    assert db_session.scalar(select(func.count()).select_from(Notification)) == 2
    assert client.get('/notifications?page_size=1', headers=headers).json()['items'][0]['id'] == a.id
    assert client.get('/notifications/unread-count', headers=headers).json() == {'count': 1}
    assert client.patch(f'/notifications/{b.id}/read', headers=headers).status_code == 404
    first = client.patch(f'/notifications/{a.id}/read', headers=headers).json()['read_at']
    assert first
    assert client.patch(f'/notifications/{a.id}/read', headers=headers).json()['read_at'] == first
    assert client.get('/notifications/unread-count', headers=headers).json()['count'] == 0
    assert client.get('/notifications?unread_only=true', headers=headers).json()['total'] == 0
    c = create_notification(db_session, recipient_id=uid, type='demo', title='Another', message='Another')
    db_session.commit()
    assert client.patch('/notifications/read-all', headers=headers).status_code == 204
    assert client.patch('/notifications/read-all', headers=headers).status_code == 204
    db_session.refresh(b); db_session.refresh(c)
    assert b.read_at is None and c.read_at is not None
    with pytest.raises(ValueError):
        create_notification(db_session, recipient_id=b.recipient_id, type='demo', title='Private', message='Private', event_key=f'test:{uid}')


@pytest.mark.parametrize('method,path', [('GET', ''), ('GET', '/unread-count'), ('PATCH', '/read-all'), ('PATCH', '/1/read')])
def test_notifications_require_authentication(client, method, path):
    assert client.request(method, '/notifications' + path).status_code == 401


def test_standalone_notification_respects_caller_rollback(actors, db_session):
    create_notification(db_session, recipient_id=actors['candidate'][0], type='demo',
                        title='Transactional example', message='Example', event_key='rollback-example')
    db_session.rollback()
    assert db_session.scalar(select(func.count()).select_from(Notification)) == 0


def test_moderation_notification_failure_rolls_back_everything(actors, db_session, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError('Persistence failure')
    monkeypatch.setattr('app.services.administration.create_notification', fail)
    with pytest.raises(RuntimeError):
        moderate(db_session, db_session.get(User, actors['admin'][0]), 'user', actors['candidate'][0], True, 'Rules violation', BackgroundTasks())
    db_session.rollback()
    assert db_session.get(User, actors['candidate'][0]).is_active
    assert db_session.scalar(select(func.count()).select_from(AuditRecord)) == 0


def test_email_failure_does_not_undo_moderation(client, actors, monkeypatch, db_session, caplog):
    from app.core.config import Settings
    from app.services.email import send_email
    monkeypatch.setattr('app.services.email.get_settings', lambda: Settings(email_mode='smtp', smtp_host='invalid.example'))
    monkeypatch.setattr('app.services.email.smtplib.SMTP', Mock(side_effect=OSError('secret must not be logged')))
    result = client.patch(f'/admin/users/{actors["candidate"][0]}/block', headers=actors['admin'][1], json={'reason': 'Platform rules'})
    assert result.status_code == 200
    assert not db_session.get(User, actors['candidate'][0]).is_active
    assert db_session.scalar(select(func.count()).select_from(Notification)) == 1
    assert send_email('private@example.com', 'Title', 'Private body') is False
    assert 'secret must not be logged' not in caplog.text
    assert 'private@example.com' not in caplog.text


def test_console_email_does_not_connect(monkeypatch):
    from app.core.config import Settings
    from app.services.email import send_email
    smtp = Mock()
    monkeypatch.setattr('app.services.email.smtplib.SMTP', smtp)
    monkeypatch.setattr('app.services.email.get_settings', lambda: Settings(email_mode='console'))
    assert send_email('fictional@example.com', 'Title', 'Body') is True
    smtp.assert_not_called()


def test_seed_is_idempotent_and_preserves_existing_data(actors, vacancy, db_session, monkeypatch):
    from app.seed_admin import seed, DEMO_EMAIL
    monkeypatch.setenv('DEV_ADMIN_PASSWORD', 'LocalOnlyTest123!')
    monkeypatch.setenv('DEV_ADMIN_EMAIL', DEMO_EMAIL)
    monkeypatch.setattr('app.seed_admin.get_settings', lambda: Settings(environment='development'))
    assert seed(db_session) == 4
    admin = db_session.scalar(select(User).where(User.email == DEMO_EMAIL))
    password_hash = admin.hashed_password
    monkeypatch.delenv('DEV_ADMIN_PASSWORD')
    assert seed(db_session) == 4
    assert admin.hashed_password == password_hash
    assert db_session.scalar(select(func.count()).select_from(User)) == 4
    assert db_session.scalar(select(func.count()).select_from(Vacancy)) == 1
    assert db_session.scalar(select(func.count()).select_from(Notification)) == 4
    assert db_session.scalar(select(func.count()).select_from(AuditRecord)) == 0


@pytest.mark.parametrize('environment', ['production', 'staging', 'test'])
def test_seed_rejects_non_development(db_session, monkeypatch, environment):
    from app.seed_admin import seed
    monkeypatch.setattr('app.seed_admin.get_settings', lambda: SimpleNamespace(environment=environment))
    with pytest.raises(RuntimeError, match='only in development'):
        seed(db_session)
    assert db_session.scalar(select(func.count()).select_from(User)) == 0


def test_seed_requires_password_and_never_promotes_user(actors, db_session, monkeypatch):
    from app.seed_admin import seed
    monkeypatch.setattr('app.seed_admin.get_settings', lambda: Settings(environment='development'))
    monkeypatch.setenv('DEV_ADMIN_EMAIL', 'new-admin@example.com')
    monkeypatch.delenv('DEV_ADMIN_PASSWORD', raising=False)
    with pytest.raises(ValueError):
        seed(db_session)
    monkeypatch.setenv('DEV_ADMIN_EMAIL', 'candidate@example.com')
    with pytest.raises(RuntimeError, match='non-admin'):
        seed(db_session)
    assert db_session.get(User, actors['candidate'][0]).role == UserRole.candidate


def test_seed_accepts_password_from_local_env_file(db_session, monkeypatch, tmp_path):
    from app.seed_admin import seed
    env_file = tmp_path / '.env'
    env_file.write_text('ENVIRONMENT=development\nDEV_ADMIN_EMAIL=file-admin@example.com\nDEV_ADMIN_PASSWORD=LocalFileOnly123!\n', encoding='utf-8')
    for name in ('ENVIRONMENT', 'DEV_ADMIN_EMAIL', 'DEV_ADMIN_PASSWORD'):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr('app.seed_admin.get_settings', lambda: Settings(_env_file=env_file))
    assert seed(db_session) == 1
    assert db_session.scalar(select(User)).email == 'file-admin@example.com'
