"""Development-only additive admin/notification seed: python -m app.seed_admin."""
from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.schemas.auth import RegisterRequest
from app.services.notifications import create_notification

DEMO_EMAIL = "admin.demo@example.com"


def seed(db: Session) -> int:
    settings = get_settings()
    if settings.environment != "development":
        raise RuntimeError("Admin seed runs only in development")
    email = str(TypeAdapter(EmailStr).validate_python(settings.dev_admin_email)).lower()
    admin = db.scalar(select(User).where(User.email == email))
    if admin is not None and admin.role != UserRole.admin:
        raise RuntimeError("Seed email already belongs to a non-admin account; no records changed")
    if admin is None:
        password = settings.dev_admin_password.get_secret_value()
        # Reuse existing password validation without allowing public Admin registration.
        RegisterRequest(email=email, password=password, full_name="Demo Administrator", role="candidate")
        admin = User(email=email, full_name="Demo Administrator", role=UserRole.admin,
                     hashed_password=hash_password(password))
        db.add(admin)
        db.flush()
    recipients = [admin]
    for role in (UserRole.candidate, UserRole.employer):
        existing = db.scalar(select(User).where(User.role == role).order_by(User.id).limit(1))
        if existing:
            recipients.append(existing)
    for recipient in recipients:
        create_notification(db, recipient_id=recipient.id, type="development_demo",
                            title="Welcome to HireDove", message="Development notification example. No action is required.",
                            event_key=f"seed:admin:welcome:{recipient.id}")
    vacancy = db.scalar(select(Vacancy).order_by(Vacancy.id).limit(1))
    if vacancy:
        create_notification(db, recipient_id=admin.id, type="development_demo",
                            title="Moderation example available", message=f"Existing vacancy #{vacancy.id} can be reviewed in the Admin Dashboard.",
                            event_key=f"seed:admin:vacancy:{admin.id}")
    db.commit()
    return len(recipients) + int(vacancy is not None)


if __name__ == "__main__":
    with SessionLocal() as db:
        count = seed(db)
    print(f"Admin development seed ready; {count} reusable notification examples.")
