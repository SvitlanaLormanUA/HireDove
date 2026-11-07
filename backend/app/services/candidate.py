from io import BytesIO
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.candidate import CandidateProfile, Resume, SavedVacancy
from app.models.user import User
from app.models.vacancy import Vacancy, VacancyStatus
from app.schemas.candidate import CandidateProfileOut, CandidateProfileWrite, ResumeWrite


def own_record(db: Session, model, user_id: int):
    record = db.scalar(select(model).where(model.user_id == user_id))
    if record is None:
        raise HTTPException(404, "Record not found")
    return record


def profile_out(profile: CandidateProfile, user: User) -> CandidateProfileOut:
    return CandidateProfileOut(
        id=profile.id, full_name=user.full_name, email=user.email,
        has_avatar=profile.avatar is not None,
        **{field: getattr(profile, field) for field in CandidateProfileWrite.model_fields if field != "full_name"},
    )


def save_profile(db: Session, user: User, data: CandidateProfileWrite) -> CandidateProfile:
    profile = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
    if profile is None:
        profile = CandidateProfile(user_id=user.id)
        db.add(profile)
    values = data.model_dump()
    user.full_name = values.pop("full_name")
    for field, value in values.items():
        setattr(profile, field, value)
    commit_unique(db)
    db.refresh(profile)
    return profile


def commit_unique(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Record already exists or the related resource was removed")


def save_resume(db: Session, user_id: int, data: ResumeWrite, create: bool) -> Resume:
    resume = db.scalar(select(Resume).where(Resume.user_id == user_id))
    if create and resume is not None:
        raise HTTPException(409, "A resume already exists. Edit your existing resume.")
    if not create and resume is None:
        raise HTTPException(404, "Resume not found")
    if resume is None:
        resume = Resume(user_id=user_id)
        db.add(resume)
    for field, value in data.model_dump().items():
        setattr(resume, field, value)
    commit_unique(db)
    db.refresh(resume)
    return resume


def save_vacancy(db: Session, user_id: int, vacancy_id: int) -> None:
    vacancy = db.get(Vacancy, vacancy_id)
    if vacancy is None or vacancy.is_hidden or vacancy.status != VacancyStatus.active:
        raise HTTPException(404, "Vacancy is unavailable")
    if db.get(SavedVacancy, (user_id, vacancy_id)) is not None:
        return
    db.add(SavedVacancy(user_id=user_id, vacancy_id=vacancy_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.get(SavedVacancy, (user_id, vacancy_id)) is None:
            raise HTTPException(409, "Vacancy is no longer available")


def convert_avatar(content: bytes) -> bytes:
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Maximum avatar size is 5 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Unsupported image")
                if image.width * image.height > 16_000_000:
                    raise ValueError("Image dimensions are too large")
                image = ImageOps.exif_transpose(image)
                image.thumbnail((512, 512))
                output = BytesIO()
                image.convert("RGB").save(output, format="WEBP", quality=85)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "Upload a valid JPEG, PNG or WebP image (up to 16 megapixels)")
