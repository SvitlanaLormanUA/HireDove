"""Fill the DB with demo vacancies properly distributed across multiple companies and employers.

    python -m app.seed_vacancies --reset
"""
import random
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.company import CompanyProfile
from app.models.user import User, UserRole
from app.models.vacancy import ExperienceLevel, Vacancy, VacancyStatus, WorkFormat

DEMO_EMAIL = "demo-employer@hiredove.com"

COMPANIES_CONFIG = [
    {
        "company_name": "Dovetail Labs",
        "email": DEMO_EMAIL,
        "full_name": "Demo Employer (Dovetail Labs)",
        "tagline": "Створюємо цифрові продукти майбутнього",
        "description": "Провідна продуктова IT-компанія. Надаємо комфортні умови для старту кар'єри початківців.",
        "website": "https://dovetail-demo.com",
        "location": "Київ",
        "industry": "IT",
        "company_size": "51-200",
        "phone": "+380441234567",
    },
    {
        "company_name": "Синій Кіт",
        "email": "bluecat@hiredove.com",
        "full_name": "Рекрутер Синій Кіт",
        "tagline": "Креативна агенція повного циклу",
        "description": "Створюємо брендинг, UI/UX дизайн та креативні медіакампанії.",
        "website": "https://bluecat.example.com",
        "location": "Львів",
        "industry": "Дизайн",
        "company_size": "11-50",
        "phone": "+380321234567",
    },
    {
        "company_name": "NovaTech",
        "email": "novatech@hiredove.com",
        "full_name": "HR NovaTech",
        "tagline": "Enterprise хмарні та AI рішення",
        "description": "Розробка складних високопродуктивних хмарних систем.",
        "website": "https://novatech.example.com",
        "location": "Київ",
        "industry": "IT",
        "company_size": "201-1000",
        "phone": "+380449876543",
    },
    {
        "company_name": "Карпати Group",
        "email": "karpaty@hiredove.com",
        "full_name": "HR Карпати Group",
        "tagline": "Фінансовий консалтинг та інвестиції",
        "description": "Сучасні фінансові послуги та аудит для бізнесу.",
        "website": "https://karpaty.example.com",
        "location": "Івано-Франківськ",
        "industry": "Фінанси",
        "company_size": "51-200",
        "phone": "+380342345678",
    },
    {
        "company_name": "BrightPath",
        "email": "brightpath@hiredove.com",
        "full_name": "Recruiter BrightPath",
        "tagline": "Онлайн-освіта нового покоління",
        "description": "Платформа інтерактивних курсів для студентів та світчерів.",
        "website": "https://brightpath.example.com",
        "location": "Одеса",
        "industry": "Освіта",
        "company_size": "11-50",
        "phone": "+380482345678",
    },
    {
        "company_name": "Лелека Digital",
        "email": "leleka@hiredove.com",
        "full_name": "Лелека Digital Team",
        "tagline": "Digital-маркетинг та ріст бізнесу",
        "description": "Performance-маркетинг, SEO та таргетована реклама для e-commerce.",
        "website": "https://leleka.example.com",
        "location": "Харків",
        "industry": "Маркетинг",
        "company_size": "11-50",
        "phone": "+380572345678",
    },
]

TITLES_BY_INDUSTRY = {
    "IT": [
        "Junior Frontend Developer (React)",
        "Junior Python Backend Developer",
        "QA Manual Intern",
        "Junior DevOps Engineer",
        "Data Analyst Intern",
    ],
    "Дизайн": [
        "Junior UI/UX Designer",
        "Graphic Designer Intern",
        "Motion Designer Junior",
        "Web Designer",
    ],
    "Маркетинг": [
        "SMM-менеджер",
        "Контент-маркетолог",
        "Стажер у відділ таргетованої реклами",
        "Junior SEO Specialist",
    ],
    "Фінанси": [
        "Junior Бухгалтер",
        "Фінансовий аналітик (стажер)",
        "Асистент аудитора",
    ],
    "Освіта": [
        "Методист онлайн-курсів",
        "Асистент викладача програмування",
        "Координатор освітніх проєктів",
    ],
}

LOCATIONS = ["Київ", "Львів", "Харків", "Одеса", "Дніпро", "Онлайн"]


def seed(reset: bool = False) -> None:
    rnd = random.Random(42)
    with SessionLocal() as db:
        if reset:
            print("Resetting demo data...")
            # Clean up all demo vacancies and profiles
            db.execute(delete(Vacancy))
            db.execute(delete(CompanyProfile))
            for c in COMPANIES_CONFIG:
                db.execute(delete(User).where(User.email == c["email"]))
            db.commit()
        elif db.scalar(select(User).where(User.email == DEMO_EMAIL)):
            print("Demo data already present. Use --reset to re-seed.")
            return

        now = datetime.now(UTC)
        company_employers = {}

        # 1. Create employers and their company profiles
        for conf in COMPANIES_CONFIG:
            employer = User(
                email=conf["email"],
                hashed_password=hash_password("demo12345"),
                full_name=conf["full_name"],
                role=UserRole.employer,
            )
            db.add(employer)
            db.flush()

            profile = CompanyProfile(
                user_id=employer.id,
                company_name=conf["company_name"],
                tagline=conf["tagline"],
                description=conf["description"],
                website=conf["website"],
                location=conf["location"],
                industry=conf["industry"],
                company_size=conf["company_size"],
                email=conf["email"],
                phone=conf["phone"],
            )
            db.add(profile)
            db.flush()

            company_employers[conf["company_name"]] = employer

        # 2. Create vacancies specifically tied to each company's employer!
        count = 0
        for conf in COMPANIES_CONFIG:
            company_name = conf["company_name"]
            employer = company_employers[company_name]
            industry = conf["industry"]
            titles = TITLES_BY_INDUSTRY.get(industry, TITLES_BY_INDUSTRY["IT"])

            # 6-7 vacancies per company
            for j in range(6):
                count += 1
                title = titles[j % len(titles)]
                loc = conf["location"] if j % 2 == 0 else rnd.choice(LOCATIONS)
                # First 5 vacancies of each company are active, 6th is closed
                status = VacancyStatus.closed if j == 5 else VacancyStatus.active

                db.add(
                    Vacancy(
                        employer_id=employer.id,
                        title=title,
                        company_name=company_name,
                        description=(
                            f"Компанія {company_name} відкриває набір на посаду «{title}». "
                            f"Ми пропонуємо комфортне робоче місце у місті {loc} або віддалено, "
                            "підтримку досвідченого ментора, гнучкий графік для студентів та прозорі "
                            "перспективи кар'єрного зростання. Від вас — бажання розвиватися та відповідальність."
                        ),
                        location=loc,
                        work_format=rnd.choice(list(WorkFormat)),
                        experience=rnd.choice([ExperienceLevel.none, ExperienceLevel.junior, ExperienceLevel.middle]),
                        industry=industry,
                        status=status,
                        is_hidden=False,
                        created_at=now - timedelta(hours=count * 5),
                    )
                )

        db.commit()
        print(f"Successfully seeded {len(COMPANIES_CONFIG)} companies and {count} vacancies.")
        print(f"Demo employer '{DEMO_EMAIL}' owns exactly 6 vacancies for 'Dovetail Labs'.")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    seed(reset=reset_flag)
