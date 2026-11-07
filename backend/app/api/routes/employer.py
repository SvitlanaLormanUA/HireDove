from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import DbSession, require_roles
from app.models.company import CompanyProfile
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy, VacancyStatus
from app.schemas.company import (
    CompanyProfileCreate,
    CompanyProfileOut,
    CompanyProfileUpdate,
)
from app.schemas.vacancy import (
    EmployerVacanciesResponse,
    VacancyCreate,
    VacancyDetailOut,
    VacancyStatusUpdate,
    VacancyUpdate,
)

router = APIRouter(prefix="/employer", tags=["employer"])

EmployerOnly = Annotated[User, Depends(require_roles(UserRole.employer))]


# ==========================================
# Company Profile CRUD
# ==========================================


@router.get("/profile", response_model=CompanyProfileOut)
def get_company_profile(user: EmployerOnly, db: DbSession) -> CompanyProfile:
    """Retrieve current employer's company profile."""
    profile = db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профіль компанії ще не створено",
        )
    return profile


@router.put("/profile", response_model=CompanyProfileOut)
@router.post("/profile", response_model=CompanyProfileOut)
def upsert_company_profile(
    data: CompanyProfileCreate, user: EmployerOnly, db: DbSession
) -> CompanyProfile:
    """Create or update the employer's company profile."""
    profile = db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    if profile is None:
        profile = CompanyProfile(user_id=user.id, **data.model_dump())
        db.add(profile)
    else:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.patch("/profile", response_model=CompanyProfileOut)
def patch_company_profile(
    data: CompanyProfileUpdate, user: EmployerOnly, db: DbSession
) -> CompanyProfile:
    """Partially update the employer's company profile."""
    profile = db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профіль компанії не знайдено",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None or field in ("tagline", "description", "website", "location", "industry", "company_size", "email", "phone"):
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


# ==========================================
# Employer Vacancies CRUD & Status Management
# ==========================================


@router.get("/vacancies", response_model=EmployerVacanciesResponse)
def list_employer_vacancies(
    user: EmployerOnly,
    db: DbSession,
    status_filter: Annotated[VacancyStatus | None, Query(alias="status")] = None,
) -> EmployerVacanciesResponse:
    """List all vacancies published by the current employer."""
    base_stmt = select(Vacancy).where(Vacancy.employer_id == user.id)

    total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
    active_count = (
        db.scalar(
            select(func.count()).select_from(
                base_stmt.where(Vacancy.status == VacancyStatus.active).subquery()
            )
        )
        or 0
    )
    closed_count = (
        db.scalar(
            select(func.count()).select_from(
                base_stmt.where(Vacancy.status == VacancyStatus.closed).subquery()
            )
        )
        or 0
    )

    query = base_stmt
    if status_filter:
        query = query.where(Vacancy.status == status_filter)

    items = db.scalars(query.order_by(Vacancy.created_at.desc(), Vacancy.id.desc())).all()

    return EmployerVacanciesResponse(
        items=list(items),
        total=total,
        active_count=active_count,
        closed_count=closed_count,
    )


@router.post("/vacancies", response_model=VacancyDetailOut, status_code=status.HTTP_201_CREATED)
def create_vacancy(
    data: VacancyCreate, user: EmployerOnly, db: DbSession
) -> Vacancy:
    """Publish a new vacancy with strict server-side validation and company attachment."""
    # Ensure company_name matches employer's profile if already configured
    profile = db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    company_name = profile.company_name if (profile and profile.company_name) else data.company_name

    vacancy = Vacancy(
        employer_id=user.id,
        title=data.title,
        company_name=company_name,
        description=data.description,
        location=data.location,
        work_format=data.work_format,
        experience=data.experience,
        industry=data.industry,
        status=data.status,
        is_hidden=False,
    )
    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)
    return vacancy


@router.get("/vacancies/{vacancy_id}", response_model=VacancyDetailOut)
def get_employer_vacancy(
    vacancy_id: int, user: EmployerOnly, db: DbSession
) -> Vacancy:
    """Get single vacancy details. Employers can only view vacancies created by their company."""
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено"
        )
    if vacancy.employer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ви можете переглядати та редагувати лише вакансії, створені вашою компанією",
        )
    return vacancy


@router.put("/vacancies/{vacancy_id}", response_model=VacancyDetailOut)
def update_employer_vacancy(
    vacancy_id: int, data: VacancyUpdate, user: EmployerOnly, db: DbSession
) -> Vacancy:
    """Update fields of an existing vacancy. Strictly restricted to vacancies of the employer's company."""
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено"
        )
    if vacancy.employer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ви не можете редагувати цю вакансію. Дозволено редагувати лише вакансії своєї компанії.",
        )

    profile = db.scalar(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "company_name" and profile and profile.company_name:
            # Force employer's verified company name if profile exists
            setattr(vacancy, field, profile.company_name)
        elif value is not None:
            setattr(vacancy, field, value)

    db.commit()
    db.refresh(vacancy)
    return vacancy


@router.patch("/vacancies/{vacancy_id}/status", response_model=VacancyDetailOut)
def update_vacancy_status(
    vacancy_id: int, data: VacancyStatusUpdate, user: EmployerOnly, db: DbSession
) -> Vacancy:
    """Switch vacancy status between active and closed. Strictly restricted to employer's company."""
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено"
        )
    if vacancy.employer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ви не можете змінювати статус цієї вакансії. Дозволено керувати лише вакансіями своєї компанії.",
        )

    vacancy.status = data.status
    db.commit()
    db.refresh(vacancy)
    return vacancy


@router.delete("/vacancies/{vacancy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employer_vacancy(
    vacancy_id: int, user: EmployerOnly, db: DbSession
) -> None:
    """Delete a vacancy owned by the employer."""
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Вакансію не знайдено"
        )
    if vacancy.employer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ви не можете видалити чужу вакансію. Дозволено видаляти лише вакансії своєї компанії.",
        )

    db.delete(vacancy)
    db.commit()
    return None
