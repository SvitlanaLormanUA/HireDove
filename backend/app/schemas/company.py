from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CompanyProfileBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    tagline: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    website: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=120)
    industry: str | None = Field(default=None, max_length=120)
    company_size: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)

    @field_validator("company_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Назва компанії повинна містити щонайменше 2 символи")
        return v

    @field_validator("website", "email", "phone", "tagline", "location", "industry", "company_size", "description")
    @classmethod
    def clean_optional_strings(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            return v if v else None
        return None


class CompanyProfileCreate(CompanyProfileBase):
    pass


class CompanyProfileUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=2, max_length=255)
    tagline: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    website: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=120)
    industry: str | None = Field(default=None, max_length=120)
    company_size: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)

    @field_validator("company_name")
    @classmethod
    def clean_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("Назва компанії повинна містити щонайменше 2 символи")
        return v

    @field_validator("website", "email", "phone", "tagline", "location", "industry", "company_size", "description")
    @classmethod
    def clean_optional_strings(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            return v if v else None
        return None


class CompanyProfileOut(CompanyProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime | None = None
