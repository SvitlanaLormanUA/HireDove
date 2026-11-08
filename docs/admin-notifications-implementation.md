# Admin Dashboard and Notifications implementation

1. **Architecture reused.** FastAPI routers, SQLAlchemy sessions/models, Pydantic
   schemas, existing JWT/RBAC dependencies, Alembic, React Router protection, the
   existing REST client, pagination, dashboard cards/buttons and theme variables.
   Registration, authentication, database selection and existing status values remain intact.

2. **Files changed.** Paths below are relative to the repository root.

   | Files | Change and purpose |
   |---|---|
   | `backend/app/models/administration.py` | New audit and notification ORM models |
   | `backend/app/schemas/administration.py` | New validated moderation requests, safe output schemas and catalog-shaped pagination |
   | `backend/app/services/administration.py` | New transactional moderation and paginated queries |
   | `backend/app/services/notifications.py` | New reusable, deduplicated notification creation within the caller's transaction |
   | `backend/app/services/email.py` | New suppressed-development/SMTP delivery abstraction |
   | `backend/app/api/routes/admin.py`, `backend/app/api/routes/notifications.py` | New protected REST APIs |
   | `backend/app/main.py`, `backend/app/models/__init__.py` | Register routers and ORM models |
   | `backend/app/api/routes/employer.py` | Prevent lifecycle changes while a vacancy is hidden |
   | `backend/app/core/config.py`, `backend/.env.example` | Environment-based SMTP and private development seed settings |
   | `backend/alembic/versions/d48a90f23b11_admin_notifications.py` | New additive migration |
   | `backend/app/seed_admin.py` | New development-only, additive seed |
   | `backend/tests/test_admin_notifications.py`, `backend/tests/test_admin_migration.py` | New module and migration tests |
   | `frontend/src/api/administration.ts` | New typed API integration |
   | `frontend/src/pages/AdminDashboardPage.tsx`, `frontend/src/pages/admin.css` | New moderation and audit interface using existing styling |
   | `frontend/src/components/HeaderTools.tsx`, `NotificationWidget.tsx`, `ThemeToggle.tsx`, `notifications.css` | New header controls, notifications and theme preference UI |
   | `frontend/src/theme.ts`, `frontend/src/index.css`, `frontend/src/main.tsx` | Restore theme before rendering and reuse both existing palettes |
   | `frontend/src/App.tsx`, `frontend/src/pages/DashboardPage.tsx` | Admin-only route and Admin dashboard dispatch |
   | `frontend/src/pages/CatalogPage.tsx`, `CandidateDashboardPage.tsx`, `EmployerDashboardPage.tsx` | Integrate controls into existing headers |
   | `README.md` | Configuration, endpoints, moderation behavior and development commands |
   | `docs/admin-notifications-implementation.md` | This implementation report |

3. **Backend.** `/admin/users`, `/admin/vacancies`, `/admin/vacancies/{id}` and
   `/admin/audit` provide filtered lists/details. User block/unblock and vacancy
   hide/restore endpoints require Admin authorization and a validated reason.
   Notification list/count/read-one/read-all endpoints require the existing current-user dependency.

4. **Frontend.** `/admin` uses the existing `ProtectedRoute` with the Admin role;
   `/dashboard` dispatches to the Admin interface for Admin accounts. Lists include
   filters, pagination, loading/empty/error states, confirmations and success feedback.
   Vacancy details expand in place. Existing dashboard/catalog headers include notifications
   and light/dark/system preferences; original palettes and brand colors are retained.

5. **Database.** Migration `d48a90f23b11`, following `c92e714a03b1`, adds only
   `audit_records` and `notifications`, with foreign keys and indexes. Target references
   preserve notification/audit history after vacancy deletion. All models are registered.
   Alembic and the application share `Settings.database_url`. No existing database was
   reset; migration verification used temporary SQLite databases.

6. **Moderation.** Blocking preserves user records and immediately stops protected
   requests with existing JWTs. Admin accounts, including the actor, cannot be moderated.
   Hiding uses the existing independent `is_hidden` flag, preserving active/closed
   status and relationships. Existing catalog/detail/Favorites/application-stub checks
   reject hidden vacancies. Employers may correct content but cannot change status while
   hidden. Restore never reactivates a closed vacancy. Audit, state and notification
   writes commit atomically; repeated no-op decisions create no extra events.

7. **Notifications and email.** Recipient isolation is enforced by backend queries.
   Read operations are idempotent. Event keys and a unique constraint prevent duplicate
   notifications. The reusable service leaves commit/rollback to its caller. Email runs
   after commit using FastAPI background tasks; failures cannot undo moderation.
   Console mode sends nothing and logs no private payload. SMTP credentials are local
   environment settings; errors omit credentials and exception details. There is no
   durable email queue or automatic delivery retry.

8. **Seed.** In `backend/`, activate the existing virtual environment, set
   `ENVIRONMENT=development` and a private `DEV_ADMIN_PASSWORD` in the process environment
   or local `.env`, then run:

   ```bash
   alembic upgrade head
   python -m app.seed_admin
   ```

   `DEV_ADMIN_EMAIL` defaults to `admin.demo@example.com`. The seed creates one Admin,
   preserves existing passwords, refuses to promote ordinary users, reuses one Candidate
   and one Employer where available, and adds up to four notifications referencing an
   existing vacancy where available. It creates no vacancies and sends no email.
   All non-development environments are rejected; reruns do not duplicate records.

9. **Tests.** Executed backend commands include `python -m pytest tests -q`,
   `python -m pytest tests/test_admin_notifications.py -q`, and
   `python -m pytest tests/test_admin_migration.py -xq --tb=short` using
   `backend/.venv/Scripts/python`. The final full-suite run passed **130 tests**
   (164 warnings); the latest module-only run passed 46 tests.
   Migration tests passed upgrade, repeated upgrade, downgrade, re-upgrade, data
   preservation and Alembic metadata comparison. Frontend `npm.cmd run lint` and
   `npm.cmd run build` both passed without lint warnings. `git diff --check` passed.

10. **README.** Added a concise operational section covering moderation, audit,
    API routes, notification refresh/read behavior, email configuration, safe development
    mode, themes, migrations, seed configuration and test commands.

11. **Regression verification.** The full backend suite exercises authentication,
    catalog/search, employer operations, candidate profiles/resumes/avatars/Favorites,
    and the new module. Applications exist only as an existing non-persistent apply
    stub; Chat is absent. Neither module was introduced or expanded.

12. **Limitations.** Browser verification was attempted but the browser access host
    was unavailable, so visual interaction and cross-browser behavior remain unverified.
    No frontend test framework exists and none was added. Migration verification used
    SQLite, not a live PostgreSQL service. Real SMTP delivery was not attempted; console
    behavior and failure isolation were tested. Existing tests emit short JWT-key and
    Starlette/httpx deprecation warnings. Persistent in-app notifications remain available
    after email failure, although blocked accounts must be unblocked before opening them.
