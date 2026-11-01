from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.security import DUMMY_HASH, create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.rate_limit import FailedLoginLimiter

router = APIRouter(prefix="/auth", tags=["auth"])

settings = get_settings()
ip_limiter = FailedLoginLimiter(settings.max_failed_logins, settings.lockout_minutes * 60)

_invalid_credentials = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
)
_too_many_attempts = HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="Too many failed login attempts. Try again later.",
)


def _issue_token(user: User) -> TokenResponse:
    token = create_access_token(user.id, user.role.value, user.token_version)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


def _as_utc(dt: datetime) -> datetime:
    # SQLite drops tzinfo; Postgres keeps it.
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: DbSession) -> TokenResponse:
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(
        email=email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_token(user)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: DbSession) -> TokenResponse:
    ip = request.client.host if request.client else "unknown"
    if ip_limiter.is_blocked(ip):
        raise _too_many_attempts

    user = db.scalar(select(User).where(User.email == data.email.lower()))
    now = datetime.now(UTC)

    if user is None:
        verify_password(data.password, DUMMY_HASH)
        ip_limiter.register_failure(ip)
        raise _invalid_credentials

    if user.locked_until and _as_utc(user.locked_until) > now:
        raise _too_many_attempts

    if not verify_password(data.password, user.hashed_password):
        ip_limiter.register_failure(ip)
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_login_attempts = 0
        db.commit()
        raise _invalid_credentials

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is blocked")

    ip_limiter.reset(ip)
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    return _issue_token(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: CurrentUser) -> None:
    # JWTs are stateless: the client deletes its token. Endpoint exists so the
    # frontend has one place to call and so we can add server-side logic later.
    return None


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(user: CurrentUser, db: DbSession) -> None:
    """Invalidate every token issued to this user (all devices)."""
    user.token_version += 1
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
