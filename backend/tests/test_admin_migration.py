from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.administration import AuditRecord, Notification
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy, VacancyStatus


def test_additive_migration_preserves_data_and_matches_metadata(tmp_path, monkeypatch):
    # Exercise the real migration chain without touching the configured application DB.
    settings = Settings(database_url=f'sqlite:///{(tmp_path / "migration.sqlite3").as_posix()}')
    monkeypatch.setattr('app.core.config.get_settings', lambda: settings)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / 'alembic.ini'))
    config.set_main_option('script_location', str(root / 'alembic'))
    command.upgrade(config, 'c92e714a03b1')
    engine = create_engine(settings.database_url)
    try:
        with Session(engine) as db:
            user = User(email='migration@example.com', full_name='Existing employer', role=UserRole.employer, hashed_password='preserve-this-hash')
            db.add(user); db.flush()
            vacancy = Vacancy(employer_id=user.id, title='Existing vacancy', company_name='Example', description='Existing data',
                              location='Kyiv', industry='IT', work_format='remote', experience='junior', status=VacancyStatus.closed, is_hidden=True)
            db.add(vacancy); db.commit()
            uid, vid = user.id, vacancy.id
        command.upgrade(config, 'head')
        command.upgrade(config, 'head')  # already upgraded: no destructive recreation
        command.check(config)  # All registered ORM models match migrated schema.
        with Session(engine) as db:
            assert db.get(User, uid).hashed_password == 'preserve-this-hash'
            assert db.get(Vacancy, vid).is_hidden
            assert db.get(Vacancy, vid).status == VacancyStatus.closed
            db.add(AuditRecord(admin_id=uid, action='hide_vacancy', target_type='vacancy', target_id=vid, reason='Example'))
            db.add(Notification(recipient_id=uid, type='demo', title='Demo', message='Demo'))
            db.commit()
            assert db.scalar(select(Notification)).id
        command.downgrade(config, 'c92e714a03b1')
        assert 'notifications' not in inspect(engine).get_table_names()
        with Session(engine) as db:
            assert db.get(User, uid).hashed_password == 'preserve-this-hash'
            assert db.get(Vacancy, vid).status == VacancyStatus.closed
        command.upgrade(config, 'head')
    finally:
        engine.dispose()
