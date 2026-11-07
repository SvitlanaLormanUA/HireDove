from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from sqlalchemy import select

from app.api.deps import DbSession, require_roles
from app.models.candidate import CandidateProfile, Resume, SavedVacancy
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy, VacancyStatus
from app.schemas.candidate import CandidateProfileOut, CandidateProfileWrite, ResumeOut, ResumeWrite
from app.schemas.vacancy import VacancyCard
from app.services.candidate import convert_avatar, own_record, profile_out, save_profile, save_resume, save_vacancy

router = APIRouter(prefix="/candidate", tags=["candidate"])
CandidateOnly = Annotated[User, Depends(require_roles(UserRole.candidate))]


@router.get("/profile", response_model=CandidateProfileOut)
def get_profile(user: CandidateOnly, db: DbSession):
    return profile_out(own_record(db, CandidateProfile, user.id), user)


@router.post("/profile", response_model=CandidateProfileOut)
@router.put("/profile", response_model=CandidateProfileOut)
def put_profile(data: CandidateProfileWrite, user: CandidateOnly, db: DbSession):
    return profile_out(save_profile(db, user, data), user)


@router.delete("/profile", status_code=204)
def delete_profile(user: CandidateOnly, db: DbSession):
    db.delete(own_record(db, CandidateProfile, user.id))
    db.commit()


@router.post("/profile/avatar", response_model=CandidateProfileOut)
def upload_avatar(file: UploadFile, user: CandidateOnly, db: DbSession):
    profile = own_record(db, CandidateProfile, user.id)
    profile.avatar = convert_avatar(file.file.read(5 * 1024 * 1024 + 1))
    db.commit()
    return profile_out(profile, user)


@router.get("/profile/avatar")
def get_avatar(user: CandidateOnly, db: DbSession):
    profile = own_record(db, CandidateProfile, user.id)
    if profile.avatar is None:
        raise HTTPException(404, "Avatar not found")
    return Response(profile.avatar, media_type="image/webp", headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@router.delete("/profile/avatar", status_code=204)
def delete_avatar(user: CandidateOnly, db: DbSession):
    profile = own_record(db, CandidateProfile, user.id)
    profile.avatar = None
    db.commit()


@router.get("/resume", response_model=ResumeOut)
def get_resume(user: CandidateOnly, db: DbSession):
    return own_record(db, Resume, user.id)


@router.post("/resume", response_model=ResumeOut, status_code=201)
def create_resume(data: ResumeWrite, user: CandidateOnly, db: DbSession):
    return save_resume(db, user.id, data, create=True)


@router.put("/resume", response_model=ResumeOut)
def update_resume(data: ResumeWrite, user: CandidateOnly, db: DbSession):
    return save_resume(db, user.id, data, create=False)


@router.delete("/resume", status_code=204)
def delete_resume(user: CandidateOnly, db: DbSession):
    db.delete(own_record(db, Resume, user.id))
    db.commit()


@router.get("/saved-vacancies", response_model=list[VacancyCard])
def get_saved(user: CandidateOnly, db: DbSession):
    vacancies = db.scalars(
        select(Vacancy).join(SavedVacancy, SavedVacancy.vacancy_id == Vacancy.id)
        .where(SavedVacancy.user_id == user.id, Vacancy.is_hidden.is_(False), Vacancy.status == VacancyStatus.active)
        .order_by(SavedVacancy.created_at.desc(), Vacancy.id.desc())
    ).all()
    return [VacancyCard(
        id=v.id, title=v.title, company_name=v.company_name, location=v.location,
        work_format=v.work_format, experience=v.experience, industry=v.industry,
        snippet=v.description[:240], created_at=v.created_at,
    ) for v in vacancies]


@router.put("/saved-vacancies/{vacancy_id}", status_code=204)
def put_saved(vacancy_id: int, user: CandidateOnly, db: DbSession):
    save_vacancy(db, user.id, vacancy_id)


@router.delete("/saved-vacancies/{vacancy_id}", status_code=204)
def delete_saved(vacancy_id: int, user: CandidateOnly, db: DbSession):
    saved = db.get(SavedVacancy, (user.id, vacancy_id))
    if saved is not None:
        db.delete(saved)
        db.commit()
