import math
from collections.abc import Sequence

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.vacancy import ExperienceLevel, Vacancy, VacancyStatus, WorkFormat
from app.schemas.vacancy import VacancyCard, VacancyPage

SNIPPET_LEN = 180


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _make_snippet(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= SNIPPET_LEN else text[: SNIPPET_LEN - 1].rstrip() + "…"


def _visible() -> Select[tuple[Vacancy]]:
    return select(Vacancy).where(Vacancy.status == VacancyStatus.active, Vacancy.is_hidden.is_(False))


def search_vacancies(
    db: Session,
    *,
    q: str | None = None,
    location: str | None = None,
    work_formats: Sequence[WorkFormat] = (),
    experiences: Sequence[ExperienceLevel] = (),
    industry: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> VacancyPage:
    stmt = _visible()

    if q and q.strip():
        # NB: Postgres ILIKE is case-insensitive for Cyrillic; SQLite's is ASCII-only (dev/tests only).
        pattern = f"%{_escape_like(q.strip())}%"
        stmt = stmt.where(
            or_(
                Vacancy.title.ilike(pattern, escape="\\"),
                Vacancy.company_name.ilike(pattern, escape="\\"),
                Vacancy.description.ilike(pattern, escape="\\"),
            )
        )
    if location:
        stmt = stmt.where(Vacancy.location == location)
    if industry:
        stmt = stmt.where(Vacancy.industry == industry)
    if work_formats:
        stmt = stmt.where(Vacancy.work_format.in_(work_formats))
    if experiences:
        stmt = stmt.where(Vacancy.experience.in_(experiences))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Vacancy.created_at.desc(), Vacancy.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()

    items = [
        VacancyCard(
            id=v.id,
            title=v.title,
            company_name=v.company_name,
            location=v.location,
            work_format=v.work_format,
            experience=v.experience,
            industry=v.industry,
            snippet=_make_snippet(v.description),
            created_at=v.created_at,
        )
        for v in rows
    ]
    return VacancyPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


def filter_options(db: Session) -> tuple[list[str], list[str]]:
    base = _visible().subquery()
    locations = db.scalars(select(base.c.location).distinct().order_by(base.c.location)).all()
    industries = db.scalars(select(base.c.industry).distinct().order_by(base.c.industry)).all()
    return list(locations), list(industries)
