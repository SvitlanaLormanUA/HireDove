import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WorkFormat(str, enum.Enum):
    office = "office"
    remote = "remote"
    hybrid = "hybrid"


class ExperienceLevel(str, enum.Enum):
    none = "none"  # без досвіду / стажування
    junior = "junior"  # до 1 року
    middle = "middle"  # 1-3 роки
    senior = "senior"  # 3+ років


class VacancyStatus(str, enum.Enum):
    active = "active"
    closed = "closed"


class Vacancy(Base):
    __tablename__ = "vacancies"

    id: Mapped[int] = mapped_column(primary_key=True)
    employer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    title: Mapped[str] = mapped_column(String(255))
    company_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)

    location: Mapped[str] = mapped_column(String(120), index=True)
    work_format: Mapped[WorkFormat] = mapped_column(Enum(WorkFormat, name="work_format"))
    experience: Mapped[ExperienceLevel] = mapped_column(Enum(ExperienceLevel, name="experience_level"))
    industry: Mapped[str] = mapped_column(String(120), index=True)

    status: Mapped[VacancyStatus] = mapped_column(
        Enum(VacancyStatus, name="vacancy_status"), default=VacancyStatus.active, index=True
    )
    # True = hidden by a moderator (admin module). Hidden vacancies never show up in the catalog.
    is_hidden: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
