from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.administration import Notification


def create_notification(db: Session, *, recipient_id: int, type: str, title: str,
                        message: str, related_type: str | None = None,
                        related_id: int | None = None, event_key: str | None = None) -> Notification:
    """Participates in the caller's transaction; never commits or sends email.

    Event keys must identify both the event and recipient. The unique constraint
    prevents concurrent duplicates; callers can retry the whole transaction on
    an IntegrityError. Avoid savepoints here: SQLite's legacy transaction mode
    can commit a standalone savepoint before the caller commits its transaction.
    """
    if event_key:
        existing = db.scalar(select(Notification).where(Notification.event_key == event_key))
        if existing:
            if existing.recipient_id != recipient_id:
                raise ValueError("Event key belongs to a different recipient")
            return existing
    notification = Notification(recipient_id=recipient_id, type=type, title=title,
                                message=message, related_type=related_type,
                                related_id=related_id, event_key=event_key)
    db.add(notification)
    db.flush()
    return notification
