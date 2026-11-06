"""Fill the DB with demo vacancies so the catalog has something to show.

    python -m app.seed_vacancies          # adds ~40 vacancies (idempotent: skips if demo employer exists)
"""
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.vacancy import ExperienceLevel, Vacancy, VacancyStatus, WorkFormat

DEMO_EMAIL = "demo-employer@hiredove.com"

TITLES = {
    "IT": ["Junior Frontend Developer", "Python Backend Intern", "QA Engineer", "Data Analyst", "UI/UX Designer"],
    "Маркетинг": ["SMM-менеджер", "Контент-маркетолог", "Стажер маркетолога", "Performance Marketing Specialist"],
    "Фінанси": ["Junior Бухгалтер", "Фінансовий аналітик", "Стажер у відділ фінансів"],
    "Освіта": ["Асистент викладача", "Методист онлайн-курсів", "Менеджер освітніх програм"],
}
COMPANIES = ["Dovetail Labs", "Синій Кіт", "NovaTech", "Карпати Group", "BrightPath", "Лелека Digital"]
LOCATIONS = ["Київ", "Львів", "Харків", "Одеса", "Дніпро", "Онлайн"]


def main() -> None:
    rnd = random.Random(42)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
            print("Demo data already present, nothing to do.")
            return
        employer = User(
            email=DEMO_EMAIL,
            hashed_password=hash_password("demo12345"),
            full_name="Demo Employer",
            role=UserRole.employer,
        )
        db.add(employer)
        db.flush()

        now = datetime.now(UTC)
        for i in range(40):
            industry = rnd.choice(list(TITLES))
            title = rnd.choice(TITLES[industry])
            company = rnd.choice(COMPANIES)
            db.add(
                Vacancy(
                    employer_id=employer.id,
                    title=title,
                    company_name=company,
                    description=(
                        f"Компанія {company} шукає кандидата на позицію «{title}». "
                        "Ми пропонуємо гнучкий графік, наставництво та реальні задачі. "
                        "Від вас — бажання вчитися й відповідальність."
                    ),
                    location=rnd.choice(LOCATIONS),
                    work_format=rnd.choice(list(WorkFormat)),
                    experience=rnd.choice(list(ExperienceLevel)),
                    industry=industry,
                    status=VacancyStatus.closed if i % 9 == 0 else VacancyStatus.active,
                    is_hidden=(i % 13 == 0),
                    created_at=now - timedelta(hours=i * 7),
                )
            )
        db.commit()
        print("Seeded 40 demo vacancies.")


if __name__ == "__main__":
    main()
