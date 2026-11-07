import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, candidate, employer, vacancies
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("hiredove")

app = FastAPI(
    title="HireDove API",
    version="0.1.0",
    # Keep Swagger in dev only.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # In dev Vite picks the next free port (5174, 5175…) if 5173 is taken.
    allow_origin_regex=None if settings.is_production else r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # NFR 1.2: never leak stack traces to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(vacancies.router)
app.include_router(employer.router)
app.include_router(candidate.router)
