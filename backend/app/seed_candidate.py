"""Development-only, additive Candidate demo: python -m app.seed_candidate."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.candidate import CandidateProfile, Resume, SavedVacancy
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy, VacancyStatus

DEMO_EMAIL = "candidate.demo@example.com"
DEMO_PASSWORD = "CandidateDemo123!"  # Public development fixture only; never used in production.


def seed(db: Session) -> int:
    if get_settings().environment != "development":
        raise RuntimeError("Candidate seed is allowed only in development")
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is None:
        user = User(email=DEMO_EMAIL, full_name="Sofia Kovalenko", role=UserRole.candidate, hashed_password=hash_password(DEMO_PASSWORD))
        db.add(user)
        db.flush()
    elif user.role != UserRole.candidate:
        raise RuntimeError("Demo email belongs to another role; refusing to modify it")
    if db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user.id)) is None:
        db.add(CandidateProfile(user_id=user.id, phone="+380501234567", location="Kyiv", education="Computer Science student, fictional Dnipro Technical College", skills="Python, React, SQL", description="Student seeking a junior development role."))
    if db.scalar(select(Resume).where(Resume.user_id == user.id)) is None:
        db.add(Resume(
            user_id=user.id, title="Junior Full-stack Developer", summary="Computer Science student building accessible web applications.",
            education=[{"name": "Dnipro Technical College (fictional)", "detail": "Computer Science", "period": "2024-2028", "description": "Algorithms, databases and web development."}],
            experience=[], skills=["Python", "React", "SQL"], languages=["Ukrainian - native", "English - B2"],
            projects=[{"name": "Campus events", "detail": "Student project", "period": "2026", "description": "Built an accessible events catalog using React and FastAPI."}],
            additional_information="Available for internships and part-time remote work.",
        ))
    vacancies = db.scalars(select(Vacancy).where(Vacancy.status == VacancyStatus.active, Vacancy.is_hidden.is_(False)).order_by(Vacancy.id).limit(2)).all()
    for vacancy in vacancies:
        if db.get(SavedVacancy, (user.id, vacancy.id)) is None:
            db.add(SavedVacancy(user_id=user.id, vacancy_id=vacancy.id))
    db.commit()
    return len(vacancies)


if __name__ == "__main__":
    with SessionLocal() as db:
        count = seed(db)
    print(f"Candidate demo ready: {DEMO_EMAIL}; {count} existing vacancies saved.")
    if count < 2:
        print("For more saved examples, create vacancies first and rerun this seed.")
