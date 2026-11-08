from datetime import datetime
from pydantic import BaseModel, Field

from app.models.application import ApplicationStatus


class ApplicationCreate(BaseModel):
    vacancy_id: int
    cover_letter: str = Field(default="", max_length=2000)


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


class ResumeSnapshot(BaseModel):
    title: str
    summary: str
    education: list
    experience: list
    projects: list
    skills: list
    languages: list
    additional_information: str


class ApplicationOut(BaseModel):
    id: int
    vacancy_id: int
    vacancy_title: str
    company_name: str
    employer_id: int
    candidate_id: int
    candidate_name: str
    candidate_email: str
    cover_letter: str
    status: ApplicationStatus
    created_at: datetime
    resume: ResumeSnapshot | None = None


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class ChatMessageOut(BaseModel):
    id: int
    application_id: int
    sender_id: int
    sender_name: str
    content: str
    is_read: bool
    created_at: datetime


class ChatThreadOut(BaseModel):
    application_id: int
    vacancy_id: int
    vacancy_title: str
    company_name: str
    partner_id: int
    partner_name: str
    status: ApplicationStatus
    unread_count: int
    last_message: str | None = None
    last_message_at: datetime | None = None