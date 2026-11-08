from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, HTTPException
from sqlalchemy import select

from app.api.deps import DbSession, require_roles
from app.models.administration import AuditRecord
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy, VacancyStatus
from app.schemas.administration import AdminUserOut, AuditOut, ModerationRequest, Page
from app.schemas.vacancy import VacancyDetailOut
from app.services.administration import moderate, paginate
from app.services.vacancy_search import _escape_like

router = APIRouter(prefix="/admin", tags=["admin"])
AdminOnly = Annotated[User, Depends(require_roles(UserRole.admin))]
PageNumber = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]
Action = Literal["block_user", "unblock_user", "hide_vacancy", "restore_vacancy"]


@router.get("/users", response_model=Page[AdminUserOut])
def users(_: AdminOnly, db: DbSession, page: PageNumber = 1, page_size: PageSize = 10,
          role: UserRole | None = None, is_active: bool | None = None,
          q: Annotated[str | None, Query(max_length=100)] = None):
    statement = select(User)
    if role is not None:
        statement = statement.where(User.role == role)
    if is_active is not None:
        statement = statement.where(User.is_active == is_active)
    if q and q.strip():
        statement = statement.where(User.full_name.ilike(f"%{_escape_like(q.strip())}%", escape="\\"))
    return paginate(db, statement.order_by(User.created_at.desc(), User.id.desc()), page, page_size)


@router.patch("/users/{user_id}/block", response_model=AdminUserOut)
def block(user_id: int, data: ModerationRequest, user: AdminOnly, db: DbSession, background: BackgroundTasks):
    return moderate(db, user, "user", user_id, True, data.reason, background)


@router.patch("/users/{user_id}/unblock", response_model=AdminUserOut)
def unblock(user_id: int, data: ModerationRequest, user: AdminOnly, db: DbSession, background: BackgroundTasks):
    return moderate(db, user, "user", user_id, False, data.reason, background)


@router.get("/vacancies", response_model=Page[VacancyDetailOut])
def vacancies(_: AdminOnly, db: DbSession, page: PageNumber = 1, page_size: PageSize = 10,
              status: VacancyStatus | None = None, is_hidden: bool | None = None,
              q: Annotated[str | None, Query(max_length=100)] = None):
    statement = select(Vacancy)
    if status is not None:
        statement = statement.where(Vacancy.status == status)
    if is_hidden is not None:
        statement = statement.where(Vacancy.is_hidden == is_hidden)
    if q and q.strip():
        statement = statement.where(Vacancy.title.ilike(f"%{_escape_like(q.strip())}%", escape="\\"))
    return paginate(db, statement.order_by(Vacancy.created_at.desc(), Vacancy.id.desc()), page, page_size)


@router.get("/vacancies/{vacancy_id}", response_model=VacancyDetailOut)
def vacancy_detail(vacancy_id: int, _: AdminOnly, db: DbSession):
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None:
        raise HTTPException(404, "Vacancy not found")
    return vacancy


@router.patch("/vacancies/{vacancy_id}/hide", response_model=VacancyDetailOut)
def hide(vacancy_id: int, data: ModerationRequest, user: AdminOnly, db: DbSession, background: BackgroundTasks):
    return moderate(db, user, "vacancy", vacancy_id, True, data.reason, background)


@router.patch("/vacancies/{vacancy_id}/restore", response_model=VacancyDetailOut)
def restore(vacancy_id: int, data: ModerationRequest, user: AdminOnly, db: DbSession, background: BackgroundTasks):
    return moderate(db, user, "vacancy", vacancy_id, False, data.reason, background)


@router.get("/audit", response_model=Page[AuditOut])
def audit(_: AdminOnly, db: DbSession, page: PageNumber = 1, page_size: PageSize = 10,
          action: Action | None = None, target_type: Literal["user", "vacancy"] | None = None,
          target_id: Annotated[int | None, Query(ge=1)] = None,
          admin_id: Annotated[int | None, Query(ge=1)] = None):
    statement = select(AuditRecord)
    for field, value in ((AuditRecord.action, action), (AuditRecord.target_type, target_type),
                         (AuditRecord.target_id, target_id), (AuditRecord.admin_id, admin_id)):
        if value is not None:
            statement = statement.where(field == value)
    return paginate(db, statement.order_by(AuditRecord.created_at.desc(), AuditRecord.id.desc()), page, page_size)
