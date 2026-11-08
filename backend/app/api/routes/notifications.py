from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, update

from app.api.deps import CurrentUser, DbSession
from app.models.administration import Notification
from app.schemas.administration import NotificationOut, Page, UnreadCount
from app.services.administration import paginate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=Page[NotificationOut])
def notifications(user: CurrentUser, db: DbSession,
                  page: Annotated[int, Query(ge=1)] = 1,
                  page_size: Annotated[int, Query(ge=1, le=100)] = 10,
                  unread_only: bool = False):
    statement = select(Notification).where(Notification.recipient_id == user.id)
    if unread_only:
        statement = statement.where(Notification.read_at.is_(None))
    return paginate(db, statement.order_by(Notification.created_at.desc(), Notification.id.desc()), page, page_size)


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(user: CurrentUser, db: DbSession):
    return UnreadCount(count=db.scalar(select(func.count()).select_from(Notification).where(
        Notification.recipient_id == user.id, Notification.read_at.is_(None))) or 0)


@router.patch("/read-all", status_code=204)
def read_all(user: CurrentUser, db: DbSession):
    db.execute(update(Notification).where(Notification.recipient_id == user.id,
        Notification.read_at.is_(None)).values(read_at=datetime.now(UTC)))
    db.commit()


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def read(notification_id: int, user: CurrentUser, db: DbSession):
    notification = db.scalar(select(Notification).where(Notification.id == notification_id,
                                                       Notification.recipient_id == user.id))
    if notification is None:
        raise HTTPException(404, "Notification not found")
    db.execute(update(Notification).where(Notification.id == notification_id,
        Notification.recipient_id == user.id, Notification.read_at.is_(None)).values(read_at=datetime.now(UTC)))
    db.commit()
    db.refresh(notification)
    return notification
