# HireDove

Job & internship platform for students and junior specialists.

- `backend/` — FastAPI, SQLAlchemy 2, Alembic, JWT auth
- `frontend/` — React + TypeScript (Vite), React Router

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional; defaults work with SQLite
alembic upgrade head
uvicorn app.main:app --reload # http://localhost:8000/docs
pytest                        # run tests
```

Create an admin (admins can't self-register):

```bash
python -m app.create_admin admin@hiredove.com "Admin Name"
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # VITE_API_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
```

## Auth API

| Method | Path               | Auth   | Description                                    |
|--------|--------------------|--------|------------------------------------------------|
| POST   | `/auth/register`   | —      | `{email, password, full_name, role}` → token   |
| POST   | `/auth/login`      | —      | `{email, password}` → token                    |
| GET    | `/auth/me`         | Bearer | Current user                                   |
| POST   | `/auth/logout`     | Bearer | Client drops its token                         |
| POST   | `/auth/logout-all` | Bearer | Invalidates all of the user's tokens           |

`role` is `candidate` or `employer`. Send the token as `Authorization: Bearer <token>`.

Error codes: `401` wrong credentials / missing or expired token, `403` blocked account or wrong role,
`409` email taken, `422` validation error, `429` too many failed logins (5 → 15 min lock, per account and per IP).

### Protecting new endpoints (backend)

```python
from app.api.deps import CurrentUser, require_roles
from app.models.user import User, UserRole

@router.get("/employer/vacancies")
def my_vacancies(user: Annotated[User, Depends(require_roles(UserRole.employer))]): ...

@router.get("/saved")
def saved(user: CurrentUser): ...   # any logged-in, non-blocked user
```

## Employer & Vacancies API

| Method | Path                              | Auth     | Description                              |
|--------|-----------------------------------|----------|------------------------------------------|
| GET    | `/employer/profile`               | Employer | Get employer's company profile           |
| PUT    | `/employer/profile`               | Employer | Create or update company profile         |
| PATCH  | `/employer/profile`               | Employer | Partial update of company profile        |
| GET    | `/employer/vacancies`             | Employer | List employer's vacancies (with counts)  |
| POST   | `/employer/vacancies`             | Employer | Create new vacancy                       |
| GET    | `/employer/vacancies/{id}`        | Employer | Get single vacancy for editing           |
| PUT    | `/employer/vacancies/{id}`        | Employer | Update vacancy                           |
| PATCH  | `/employer/vacancies/{id}/status` | Employer | Toggle status (`active` / `closed`)      |
| DELETE | `/employer/vacancies/{id}`        | Employer | Delete vacancy                           |
| GET    | `/vacancies/{id}`                 | Public   | Full details of a vacancy                |

### Schema changes

```bash
alembic revision --autogenerate -m "add vacancies"
alembic upgrade head
```



## Candidate Dashboard and Resume Management

Candidates use `/dashboard` to manage their profile, one private resume, and saved
vacancies/internships. The editor supports multiple education, experience and project
entries; employment history is optional. Name/email reuse the User record. Profile
deletion removes extra profile data and avatar, preserving the account, resume and Favorites.
Avatars accept JPEG/PNG/WebP (5 MB, 16 megapixels maximum), are converted to WebP
at up to 512px, and stored in the database; no upload directory or new environment
variables are required. Install the updated backend requirements (adds Pillow).

Candidate-only API (existing Bearer JWT):

| Methods | Path | Purpose |
|---------|------|---------|
| GET, POST, PUT, DELETE | `/candidate/profile` | Own profile; POST/PUT create or replace profile fields |
| GET, POST, DELETE | `/candidate/profile/avatar` | Own avatar; POST uses multipart `file` |
| GET, POST, PUT, DELETE | `/candidate/resume` | Own resume; POST creates, PUT replaces |
| GET | `/candidate/saved-vacancies` | Own available saved vacancy cards |
| PUT, DELETE | `/candidate/saved-vacancies/{id}` | Idempotent save/remove |

Resume writes require a title (2–255 characters). Education, experience and projects
are arrays of `{name, detail, period, description}`; skills/languages are string arrays.
Other sections are optional. Hidden/closed vacancies are unavailable to save and
omitted from Favorites until active again. Use the catalog's Save button to add items
and the dashboard's Saved tab to remove them.

From `backend/` (activate `.venv` first; Windows: `.venv\Scripts\Activate.ps1`):

```bash
pip install -r requirements.txt
alembic upgrade head
python -m app.seed_candidate
pytest tests/test_candidate.py -q
pytest tests -q  # includes auth, search/catalog and employer regression tests
```

Migration `c92e714a03b1` follows `f7c1f38c6b2b` and adds only
`candidate_profiles`, `resumes`, and `saved_vacancies`; existing data is preserved.
The additive seed runs only with `ENVIRONMENT=development` (the default), creates
`candidate.demo@example.com` / `CandidateDemo123!` (development only), one fictional
profile and student resume, and saves up to two existing active vacancies. It preserves
existing records and passwords on reruns. Create vacancies before seeding to get saved
examples; the seed does not create or modify employer/vacancy records.

From `frontend/`, run `npm run lint` and `npm run build`. No frontend test framework
is configured; no additional frontend testing dependency is introduced.



## Admin Dashboard and Notifications

Admins use `/admin` or their existing `/dashboard` entry with the same JWT/RBAC.
The dashboard provides paginated user/vacancy lists, filters, moderation reasons,
confirmation prompts, and a read-only audit journal. Admin accounts cannot be
blocked or unblocked through moderation. Blocking takes effect on the next
protected request, including already-issued JWTs, and preserves profiles/resumes.
Blocked users cannot open notifications until unblocked; email remains available.

Vacancy moderation uses the existing `is_hidden` flag independently of `active` /
`closed`. Hidden vacancies disappear from catalog, details, filters and Favorites;
existing records remain intact. Employers can correct content but cannot change
its lifecycle status while hidden. Restore preserves the previous active/closed
state. Applications and Chat are not present and are not added by this module.

Admin API: `GET /admin/users`, `GET /admin/vacancies`,
`GET /admin/vacancies/{id}`, `GET /admin/audit`; `PATCH /admin/users/{id}/block`
or `/unblock`, and `PATCH /admin/vacancies/{id}/hide` or `/restore`, each with
`{"reason":"..."}` (3–1000 characters). Lists follow catalog `page`, `page_size`,
`items`, `total`, `pages` conventions. User filters: `role`, `is_active`, `q`;
vacancy filters: `status`, `is_hidden`, `q`; audit filters: `action`, `target_type`,
`target_id`, `admin_id`. Audit records contain actor, action, target, time and reason.
State changes, audit and recipient notifications commit in one transaction;
repeating an already-applied action does not send another notification or email.

The header notification entry shows unread counts, paginated recent messages,
read indicators, mark-one/all-read actions and safe related navigation. It refreshes
on opening or manual refresh; no WebSockets or polling are required.
Recipient-only API: `GET /notifications`, `GET /notifications/unread-count`,
`PATCH /notifications/{id}/read`, `PATCH /notifications/read-all`.
`create_notification()` is reusable by future modules; pass a unique event key per
event/recipient to deduplicate retries. Notifications survive removal of related content.

Critical moderation events trigger best-effort email **after commit**.
`EMAIL_MODE=console` (default) sends nothing and logs only a suppression notice.
For real delivery set `EMAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT` (587),
`SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_STARTTLS` (true).
Credentials come from environment/local `.env`; delivery errors are redacted and
cannot roll back moderation. There is no durable email queue or automatic retry;
in-app notifications are persistent. Light/dark/system selection reuses the existing
palettes and persists in browser local storage (`hiredove_theme`).

From `backend/`, with the existing virtual environment active:

```bash
alembic upgrade head
# ENVIRONMENT must be development. Set DEV_ADMIN_PASSWORD privately in the
# process environment or local backend/.env; optionally set DEV_ADMIN_EMAIL.
python -m app.seed_admin
pytest tests/test_admin_notifications.py tests/test_admin_migration.py -q
pytest tests -q
```

Migration `d48a90f23b11` adds only `audit_records` and `notifications`, including
foreign keys/indexes; Alembic and the app both read `Settings.database_url`.
The idempotent seed creates one fictional `admin.demo@example.com` Admin by default,
using the supplied password (existing passwords are preserved), and up to four demo
notifications for that Admin and up to two existing Candidate/Employer accounts.
It reuses one Candidate and one Employer where available and references an existing
vacancy; no users other than the Admin,
vacancies, moderation changes or email deliveries are generated. It rejects all
non-development environments and refuses to promote an existing ordinary account.
Never enable this seed against production data.

From `frontend/`: `npm run lint` and `npm run build`. There is no existing frontend
test framework; backend tests cover authorization, lifecycle, privacy, event
deduplication, transaction rollback, email failures, seed safety, and migration
upgrade/downgrade data preservation. Browser checks complement these tests.



## Deployment

**Database → Neon** (free Postgres, doesn't expire). Create a project, copy the connection string.
> Render's free Postgres is deleted 30 days after creation, which falls before the project end date.

**Backend → Render.** New → Blueprint → select this repo (uses `render.yaml`). Set:
- `DATABASE_URL` — Neon connection string
- `CORS_ORIGINS` — the Vercel URL, e.g. `https://hiredove.vercel.app` (no trailing slash)

**Frontend → Vercel.** New Project → import repo → Root Directory `frontend` (Vite preset is detected). Set:
- `VITE_API_URL` — the Render URL, e.g. `https://hiredove-api.onrender.com`

`vercel.json` rewrites all paths to `index.html` so React Router routes work on refresh.

Note: the free Render instance sleeps after 15 min idle; the first request after that takes ~30–60 s.
