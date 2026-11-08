import math

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.administration import AuditRecord
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.schemas.administration import Page
from app.services.email import send_email
from app.services.notifications import create_notification


def paginate(db: Session, statement, page: int, page_size: int) -> Page:
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    items = db.scalars(statement.limit(page_size).offset((page - 1) * page_size)).all()
    return Page(items=list(items), total=total, page=page, page_size=page_size,
                pages=math.ceil(total / page_size))


def moderate(db: Session, admin: User, target_type: str, target_id: int,
             restricted: bool, reason: str, background: BackgroundTasks):
    model = User if target_type == "user" else Vacancy
    target = db.get(model, target_id)
    if target is None:
        raise HTTPException(404, "Moderation target not found")
    if isinstance(target, User) and (target.id == admin.id or target.role == UserRole.admin):
        raise HTTPException(403, "Admin accounts cannot be moderated")
    field = User.is_active if model is User else Vacancy.is_hidden
    desired = not restricted if model is User else restricted
    # Conditional UPDATE serializes state transitions and suppresses duplicate requests.
    result = db.execute(update(model).where(model.id == target_id, field != desired)
                        .values({field.key: desired}).execution_options(synchronize_session=False))
    if not result.rowcount:
        db.refresh(target)
        return target
    action = ("block_user" if restricted else "unblock_user") if model is User else ("hide_vacancy" if restricted else "restore_vacancy")
    audit = AuditRecord(admin_id=admin.id, action=action, target_type=target_type,
                        target_id=target_id, reason=reason)
    db.add(audit)
    db.flush()
    recipient_id = target.id if model is User else target.employer_id
    title = {"block_user": "Account blocked", "unblock_user": "Account unblocked",
             "hide_vacancy": "Vacancy hidden", "restore_vacancy": "Vacancy restored"}[action]
    message = f"{title}. Reason: {reason}"
    create_notification(db, recipient_id=recipient_id, type=action, title=title,
                        message=message, related_type=target_type, related_id=target_id,
                        event_key=f"moderation:{audit.id}:{recipient_id}")
    recipient = db.get(User, recipient_id)
    email = recipient.email
    # State, audit and in-app notification are atomic. Email starts only after success.
    db.commit()
    db.refresh(target)
    background.add_task(send_email, email, title, message)
    return target
