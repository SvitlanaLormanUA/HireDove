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
