from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.vacancy import ExperienceLevel, WorkFormat


class VacancyCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company_name: str
    location: str
    work_format: WorkFormat
    experience: ExperienceLevel
    industry: str
    snippet: str
    created_at: datetime


class VacancyPage(BaseModel):
    items: list[VacancyCard]
    total: int
    page: int
    page_size: int
    pages: int


class FilterOptions(BaseModel):
    locations: list[str]
    industries: list[str]
