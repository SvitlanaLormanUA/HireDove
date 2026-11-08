from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession, require_roles
from app.models.application import Application, ApplicationStatus, ChatMessage
from app.models.candidate import Resume
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy, VacancyStatus
from app.schemas.application import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationStatusUpdate,
    ChatMessageCreate,
    ChatMessageOut,
    ChatThreadOut,
    ResumeSnapshot,
)
from app.services.notifications import create_notification

router = APIRouter(tags=["applications & chat"])

STATUS_LABELS_UA = {
    ApplicationStatus.new: "Новий",
    ApplicationStatus.reviewed: "Переглянуто",
    ApplicationStatus.accepted: "Прийнято (Запрошення)",
    ApplicationStatus.rejected: "Відхилено",
}


def _build_application_out(
    db: DbSession, app_obj: Application, vacancy: Vacancy, candidate: User, include_resume: bool = False
) -> ApplicationOut:
    resume_snapshot = None
    if include_resume:
        resume = db.scalar(select(Resume).where(Resume.user_id == candidate.id))
        if resume:
            resume_snapshot = ResumeSnapshot(
                title=resume.title,
                summary=resume.summary,
                education=resume.education or [],
                experience=resume.experience or [],
                projects=resume.projects or [],
                skills=resume.skills or [],
                languages=resume.languages or [],
                additional_information=resume.additional_information or "",
            )

    return ApplicationOut(
        id=app_obj.id,
        vacancy_id=vacancy.id,
        vacancy_title=vacancy.title,
        company_name=vacancy.company_name,
        employer_id=vacancy.employer_id,
        candidate_id=candidate.id,
        candidate_name=candidate.full_name,
        candidate_email=candidate.email,
        cover_letter=app_obj.cover_letter,
        status=app_obj.status,
        created_at=app_obj.created_at,
        resume=resume_snapshot,
    )


@router.post("/applications", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: ApplicationCreate,
    db: DbSession,
    user: Annotated[User, Depends(require_roles(UserRole.candidate))],
) -> ApplicationOut:
    vacancy = db.get(Vacancy, payload.vacancy_id)
    if not vacancy or vacancy.is_hidden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено")

    # FR 18: Candidate cannot apply to closed vacancy
    if vacancy.status != VacancyStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неможливо відгукнутися на закриту вакансію",
        )

    # FR 12 & NFR 1.2: Prevent duplicate applications
    existing = db.scalar(
        select(Application).where(
            Application.vacancy_id == payload.vacancy_id,
            Application.candidate_id == user.id,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ви вже відгукнулися на цю вакансію",
        )

    app_obj = Application(
        vacancy_id=vacancy.id,
        candidate_id=user.id,
        cover_letter=payload.cover_letter.strip(),
        status=ApplicationStatus.new,
    )
    db.add(app_obj)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ви вже відгукнулися на цю вакансію",
        )

    # Notify employer (FR 22)
    create_notification(
        db,
        recipient_id=vacancy.employer_id,
        type="application_received",
        title="Новий відгук на вакансію",
        message=f"Кандидат {user.full_name} відгукнувся на вакансію «{vacancy.title}».",
        related_type="vacancy",
        related_id=vacancy.id,
        event_key=f"app_created:{app_obj.id}:emp:{vacancy.employer_id}",
    )

    db.commit()
    db.refresh(app_obj)
    return _build_application_out(db, app_obj, vacancy, user, include_resume=True)


@router.get("/applications/my", response_model=list[ApplicationOut])
def list_my_applications(
    db: DbSession,
    user: Annotated[User, Depends(require_roles(UserRole.candidate))],
) -> list[ApplicationOut]:
    rows = db.execute(
        select(Application, Vacancy)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .where(Application.candidate_id == user.id)
        .order_by(Application.created_at.desc())
    ).all()
    return [_build_application_out(db, app_obj, vac, user, include_resume=False) for app_obj, vac in rows]


@router.get("/applications/employer", response_model=list[ApplicationOut])
def list_employer_applications(
    db: DbSession,
    user: Annotated[User, Depends(require_roles(UserRole.employer))],
    vacancy_id: int | None = Query(default=None),
) -> list[ApplicationOut]:
    stmt = (
        select(Application, Vacancy, User)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .join(User, Application.candidate_id == User.id)
        .where(Vacancy.employer_id == user.id)
        .order_by(Application.created_at.desc())
    )
    if vacancy_id is not None:
        stmt = stmt.where(Application.vacancy_id == vacancy_id)

    rows = db.execute(stmt).all()
    return [
        _build_application_out(db, app_obj, vac, cand, include_resume=True)
        for app_obj, vac, cand in rows
    ]


@router.patch("/applications/{application_id}/status", response_model=ApplicationOut)
def update_application_status(
    application_id: int,
    payload: ApplicationStatusUpdate,
    db: DbSession,
    user: Annotated[User, Depends(require_roles(UserRole.employer))],
) -> ApplicationOut:
    app_obj = db.get(Application, application_id)
    if not app_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Відгук не знайдено")

    vacancy = db.get(Vacancy, app_obj.vacancy_id)
    if not vacancy or vacancy.employer_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Немає доступу до цього відгуку")

    candidate = db.get(User, app_obj.candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Кандидата не знайдено")

    if app_obj.status != payload.status:
        app_obj.status = payload.status
        status_label = STATUS_LABELS_UA.get(payload.status, payload.status.value)
        create_notification(
            db,
            recipient_id=candidate.id,
            type="application_status",
            title="Зміна статусу відгуку",
            message=f"Статус вашого відгуку на вакансію «{vacancy.title}» ({vacancy.company_name}) змінено на: {status_label}.",
            related_type="vacancy",
            related_id=vacancy.id,
        )
        db.commit()
        db.refresh(app_obj)

    return _build_application_out(db, app_obj, vacancy, candidate, include_resume=True)


# ─── INTERNAL CHAT ENDPOINTS ──────────────────────────────────────────────────

def _verify_chat_participant(db: DbSession, application_id: int, user: User) -> tuple[Application, Vacancy, User]:
    app_obj = db.get(Application, application_id)
    if not app_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Діалог не знайдено")
    vacancy = db.get(Vacancy, app_obj.vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено")

    if user.id not in (app_obj.candidate_id, vacancy.employer_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ до приватного чату заборонено")

    partner_id = vacancy.employer_id if user.id == app_obj.candidate_id else app_obj.candidate_id
    partner = db.get(User, partner_id)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Співрозмовника не знайдено")

    return app_obj, vacancy, partner


@router.get("/chats", response_model=list[ChatThreadOut])
def list_chat_threads(db: DbSession, user: CurrentUser) -> list[ChatThreadOut]:
    if user.role == UserRole.candidate:
        stmt = (
            select(Application, Vacancy, User)
            .join(Vacancy, Application.vacancy_id == Vacancy.id)
            .join(User, Vacancy.employer_id == User.id)
            .where(Application.candidate_id == user.id)
            .order_by(Application.created_at.desc())
        )
    elif user.role == UserRole.employer:
        stmt = (
            select(Application, Vacancy, User)
            .join(Vacancy, Application.vacancy_id == Vacancy.id)
            .join(User, Application.candidate_id == User.id)
            .where(Vacancy.employer_id == user.id)
            .order_by(Application.created_at.desc())
        )
    else:
        return []

    rows = db.execute(stmt).all()
    threads: list[ChatThreadOut] = []

    for app_obj, vac, partner in rows:
        last_msg = db.scalar(
            select(ChatMessage)
            .where(ChatMessage.application_id == app_obj.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        unread_count = db.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.application_id == app_obj.id,
                ChatMessage.sender_id != user.id,
                ChatMessage.is_read.is_(False),
            )
        ) or 0

        threads.append(
            ChatThreadOut(
                application_id=app_obj.id,
                vacancy_id=vac.id,
                vacancy_title=vac.title,
                company_name=vac.company_name,
                partner_id=partner.id,
                partner_name=partner.full_name,
                status=app_obj.status,
                unread_count=unread_count,
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else app_obj.created_at,
            )
        )

    threads.sort(key=lambda t: t.last_message_at or t.application_id, reverse=True)
    return threads


@router.get("/chats/{application_id}/messages", response_model=list[ChatMessageOut])
def get_chat_messages(application_id: int, db: DbSession, user: CurrentUser) -> list[ChatMessageOut]:
    app_obj, _, _ = _verify_chat_participant(db, application_id, user)

    # Mark incoming unread messages as read
    unread_msgs = db.scalars(
        select(ChatMessage).where(
            ChatMessage.application_id == app_obj.id,
            ChatMessage.sender_id != user.id,
            ChatMessage.is_read.is_(False),
        )
    ).all()
    if unread_msgs:
        for m in unread_msgs:
            m.is_read = True
        db.commit()

    rows = db.execute(
        select(ChatMessage, User)
        .join(User, ChatMessage.sender_id == User.id)
        .where(ChatMessage.application_id == app_obj.id)
        .order_by(ChatMessage.created_at.asc())
    ).all()

    return [
        ChatMessageOut(
            id=msg.id,
            application_id=msg.application_id,
            sender_id=msg.sender_id,
            sender_name=sender.full_name,
            content=msg.content,
            is_read=msg.is_read,
            created_at=msg.created_at,
        )
        for msg, sender in rows
    ]


@router.post(
    "/chats/{application_id}/messages",
    response_model=ChatMessageOut,
    status_code=status.HTTP_201_CREATED,
)
def send_chat_message(
    application_id: int,
    payload: ChatMessageCreate,
    db: DbSession,
    user: CurrentUser,
) -> ChatMessageOut:
    app_obj, vacancy, partner = _verify_chat_participant(db, application_id, user)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Повідомлення не може бути порожнім")

    msg = ChatMessage(
        application_id=app_obj.id,
        sender_id=user.id,
        content=content,
        is_read=False,
    )
    db.add(msg)
    db.flush()

    create_notification(
        db,
        recipient_id=partner.id,
        type="new_message",
        title="Нове повідомлення у чаті",
        message=f"{user.full_name} надіслав(-ла) повідомлення щодо вакансії «{vacancy.title}».",
        related_type="vacancy",
        related_id=vacancy.id,
    )

    db.commit()
    db.refresh(msg)

    return ChatMessageOut(
        id=msg.id,
        application_id=msg.application_id,
        sender_id=msg.sender_id,
        sender_name=user.full_name,
        content=msg.content,
        is_read=msg.is_read,
        created_at=msg.created_at,
    )