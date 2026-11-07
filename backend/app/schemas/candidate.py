from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=255)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class CandidateProfileWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: Name
    phone: str = Field(default="", max_length=50)
    location: str = Field(default="", max_length=120)
    education: str = Field(default="", max_length=5000)
    skills: str = Field(default="", max_length=5000)
    description: str = Field(default="", max_length=5000)


class CandidateProfileOut(CandidateProfileWrite):
    id: int
    email: str
    has_avatar: bool


class ResumeEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Name
    detail: str = Field(default="", max_length=255)
    period: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=5000)


class ResumeWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: Name
    summary: str = Field(default="", max_length=5000)
    education: list[ResumeEntry] = Field(default_factory=list, max_length=30)
    experience: list[ResumeEntry] = Field(default_factory=list, max_length=30)
    projects: list[ResumeEntry] = Field(default_factory=list, max_length=30)
    skills: list[ShortText] = Field(default_factory=list, max_length=100)
    languages: list[ShortText] = Field(default_factory=list, max_length=50)
    additional_information: str = Field(default="", max_length=5000)


class ResumeOut(ResumeWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime | None
