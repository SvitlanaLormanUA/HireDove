from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models.user import UserRole
from app.models.vacancy import ExperienceLevel, Vacancy, VacancyStatus, WorkFormat
from app.schemas.vacancy import FilterOptions, VacancyDetailOut, VacancyPage
from app.services.vacancy_search import filter_options, search_vacancies

router = APIRouter(prefix="/vacancies", tags=["vacancies"])


# NB: keep fixed paths (/search, /filters) ABOVE any future "/{vacancy_id}" route,
# otherwise FastAPI would try to parse "search" as an id.
@router.get("/search", response_model=VacancyPage)
def search(
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    location: Annotated[str | None, Query(max_length=120)] = None,
    work_format: Annotated[list[WorkFormat] | None, Query()] = None,
    experience: Annotated[list[ExperienceLevel] | None, Query()] = None,
    industry: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
) -> VacancyPage:
    """Public catalog search (no auth). Only active, non-hidden vacancies."""
    return search_vacancies(
        db,
        q=q,
        location=location,
        work_formats=work_format or [],
        experiences=experience or [],
        industry=industry,
        page=page,
        page_size=page_size,
    )


@router.get("/filters", response_model=FilterOptions)
def filters(db: DbSession) -> FilterOptions:
    """Values for the filter dropdowns (only those that have at least one visible vacancy)."""
    locations, industries = filter_options(db)
    return FilterOptions(locations=locations, industries=industries)


@router.get("/{vacancy_id}", response_model=VacancyDetailOut)
def get_vacancy_detail(vacancy_id: int, db: DbSession) -> Vacancy:
    """Public detailed view of an active vacancy."""
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None or vacancy.is_hidden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено")
    return vacancy


@router.post("/{vacancy_id}/apply")
def apply_to_vacancy(vacancy_id: int, user: CurrentUser, db: DbSession) -> dict[str, str]:
    """Candidate application to a vacancy. Employers are strictly forbidden from applying."""
    if user.role == UserRole.employer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Роботодавці не можуть відгукуватися на вакансії. Відгуки доступні лише кандидатам.",
        )
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None or vacancy.is_hidden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено")
    if vacancy.status != VacancyStatus.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ця вакансія закрита для нових відгуків")
    return {"status": "ok", "message": "Відгук успішно зареєстровано"}
