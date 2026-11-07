from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.vacancy import ExperienceLevel, VacancyStatus, WorkFormat


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


class VacancyDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employer_id: int
    title: str
    company_name: str
    description: str
    location: str
    work_format: WorkFormat
    experience: ExperienceLevel
    industry: str
    status: VacancyStatus
    is_hidden: bool
    created_at: datetime


class VacancyCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    company_name: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=20, max_length=20000)
    location: str = Field(min_length=2, max_length=120)
    work_format: WorkFormat
    experience: ExperienceLevel
    industry: str = Field(min_length=2, max_length=120)
    status: VacancyStatus = VacancyStatus.active

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Назва посади повинна містити щонайменше 3 символи")
        return v

    @field_validator("company_name")
    @classmethod
    def clean_company_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Назва компанії повинна містити щонайменше 2 символи")
        return v

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Опис вакансії повинен бути інформативним (щонайменше 20 символів)")
        return v

    @field_validator("location")
    @classmethod
    def clean_location(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Локація повинна містити щонайменше 2 символи")
        return v

    @field_validator("industry")
    @classmethod
    def clean_industry(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Галузь повинна містити щонайменше 2 символи")
        return v


class VacancyUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    company_name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, min_length=20, max_length=20000)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    work_format: WorkFormat | None = None
    experience: ExperienceLevel | None = None
    industry: str | None = Field(default=None, min_length=2, max_length=120)
    status: VacancyStatus | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 3:
                raise ValueError("Назва посади повинна містити щонайменше 3 символи")
        return v

    @field_validator("company_name")
    @classmethod
    def clean_company_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("Назва компанії повинна містити щонайменше 2 символи")
        return v

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 20:
                raise ValueError("Опис вакансії повинен бути інформативним (щонайменше 20 символів)")
        return v

    @field_validator("location")
    @classmethod
    def clean_location(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("Локація повинна містити щонайменше 2 символи")
        return v

    @field_validator("industry")
    @classmethod
    def clean_industry(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("Галузь повинна містити щонайменше 2 символи")
        return v


class VacancyStatusUpdate(BaseModel):
    status: VacancyStatus


class EmployerVacanciesResponse(BaseModel):
    items: list[VacancyDetailOut]
    total: int
    active_count: int
    closed_count: int
