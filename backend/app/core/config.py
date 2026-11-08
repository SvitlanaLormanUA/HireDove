from functools import lru_cache

from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # development | production
    database_url: str = "sqlite:///./hiredove.db"

    jwt_secret: str = "dev-only-insecure-secret-change-me-in-prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # NFR 1.3: session lives 24h

    # Comma-separated list of allowed frontend origins, e.g. "https://hiredove.vercel.app"
    cors_origins: str = "http://localhost:5173"

    # No network delivery unless SMTP is explicitly selected.
    email_mode: Literal["console", "smtp"] = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = "noreply@example.com"
    smtp_starttls: bool = True
    dev_admin_email: str = "admin.demo@example.com"
    dev_admin_password: SecretStr = SecretStr("")

    # NFR 1.3: lock after 5 failed logins in a row
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, v: str) -> str:
        # Render/Neon hand out "postgres://" or "postgresql://"; SQLAlchemy needs the driver name.
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and settings.jwt_secret == "dev-only-insecure-secret-change-me-in-prod":
        raise RuntimeError("JWT_SECRET must be set in production")
    return settings
