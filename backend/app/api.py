import hmac
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError

from .config import Settings
from .db import build_engine, check_ready
from .errors import DomainError
from .repository import Repository
from .schemas import (
    AccountFilter,
    CaseFilter,
    CaseUpdate,
    CaseWrite,
    Collection,
    CommentFilter,
    DetectionWrite,
    Identifier,
    NoteWrite,
    Page,
    ReviewWrite,
    wire,
)

bearer = HTTPBearer(auto_error=False)


def require_key(
    request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
):
    configured = request.app.state.settings.api_key
    if configured is None:
        raise DomainError(503, "API access is not configured")
    if credentials is None or not hmac.compare_digest(
        credentials.credentials.encode(), configured.get_secret_value().encode()
    ):
        raise DomainError(401, "A valid bearer API key is required")


def get_repository(request: Request) -> Repository:
    if request.app.state.engine is None:
        raise DomainError(503, "Database is not configured")
    return Repository(request.app.state.engine, request.app.state.settings.investigator_id)


Repo = Annotated[Repository, Depends(get_repository)]
Paging = Annotated[Page, Query()]
router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_key)])


@router.get("/accounts", response_model=Collection, tags=["Accounts"])
def accounts(repo: Repo, filters: Annotated[AccountFilter, Query()]):
    return wire(repo.accounts(filters, filters.q, filters.provenance_id))


@router.get("/accounts/{account_id}", tags=["Accounts"])
def account(account_id: Identifier, repo: Repo):
    return wire(repo.account(account_id))


@router.get("/accounts/{account_id}/logins", response_model=Collection, tags=["Accounts"])
def logins(account_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.logins(account_id, page))


@router.get("/comments", response_model=Collection, tags=["Comments"])
def comments(repo: Repo, filters: Annotated[CommentFilter, Query()]):
    return wire(repo.comments(filters))


@router.get("/accounts/{account_id}/findings", response_model=Collection, tags=["Accounts"])
def account_findings(account_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.account_findings(account_id, page))


@router.get("/accounts/{account_id}/related", response_model=Collection, tags=["Accounts"])
def related_accounts(account_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.related_accounts(account_id, page))


@router.get("/settings", tags=["Reference"])
def settings_info(request: Request):
    settings = request.app.state.settings
    check_ready(request.app.state.engine, settings.investigator_id)
    with request.app.state.engine.connect() as conn:
        database_name = conn.scalar(text("SELECT DB_NAME()"))
    return {
        "status": "ready",
        "database": "Microsoft SQL Server",
        "database_name": database_name,
        "investigator_id": settings.investigator_id,
        "authentication": "Local shared service key; no multi-user authentication",
        "rules": "Persisted SQL v1; read-only metadata",
        "timestamps": "UTC",
    }


@router.get("/comments/{comment_id}", tags=["Comments"])
def comment(comment_id: Identifier, repo: Repo):
    return wire(repo.comment(comment_id))


@router.get("/overview", tags=["Reports"])
def overview(repo: Repo, filters: Annotated[CommentFilter, Query()]):
    """Counts and chart cover all matching comments; pagination does not limit totals."""
    return wire(repo.overview(filters))


@router.post("/comments/{comment_id}/reviews", status_code=201, tags=["Comments"])
def review(comment_id: Identifier, data: ReviewWrite, repo: Repo):
    return wire(repo.review(comment_id, data))


@router.get("/provenance", response_model=Collection, tags=["Reference"])
def provenance(repo: Repo, page: Paging):
    return wire(repo.catalog("provenance", page))


@router.get("/rules", response_model=Collection, tags=["Detection"])
def rules(repo: Repo, page: Paging):
    return wire(repo.catalog("rules", page))


@router.get("/network", response_model=Collection, tags=["Network"])
def network(repo: Repo, page: Paging):
    """Observed account/device links; coordination is served separately."""
    return wire(repo.network(page))


@router.get("/coordination", response_model=Collection, tags=["Network"])
def coordination(repo: Repo, page: Paging):
    return wire(repo.catalog("coordination", page))


@router.get("/coordination/{anchor_id}/comments", response_model=Collection, tags=["Network"])
def coordination_comments(anchor_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.coordination_evidence(anchor_id, page))


@router.get("/evidence/{evidence_id}", tags=["Evidence"])
def evidence(evidence_id: Identifier, repo: Repo):
    return wire(repo.evidence(evidence_id))


@router.get("/detection-runs", response_model=Collection, tags=["Detection"])
def runs(repo: Repo, page: Paging):
    return wire(repo.catalog("runs", page))


@router.post("/detection-runs", status_code=201, tags=["Detection"])
def detect(data: DetectionWrite, repo: Repo):
    """Persist a SQL v1 run. A reused ID returns 409 and never reruns silently."""
    return wire(repo.run_detection(data.id))


@router.get("/detection-runs/{run_id}/findings", response_model=Collection, tags=["Detection"])
def findings(run_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.findings(run_id, page))


@router.get("/findings/{finding_id}", tags=["Evidence"])
def finding(finding_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.finding(finding_id, page))


@router.get("/cases", response_model=Collection, tags=["Cases"])
def cases(repo: Repo, filters: Annotated[CaseFilter, Query()]):
    return wire(repo.cases(filters))


@router.get("/findings/{finding_id}/evidence", response_model=Collection, tags=["Evidence"])
def finding_evidence(finding_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.finding(finding_id, page)["evidence"])


@router.post("/cases", status_code=201, tags=["Cases"])
def create_case(data: CaseWrite, repo: Repo):
    return wire(repo.create_case(data))


@router.get("/cases/{case_id}", tags=["Cases"])
def case(case_id: Identifier, repo: Repo):
    return wire(repo.case(case_id))


@router.put("/cases/{case_id}", tags=["Cases"])
def update_case(case_id: Identifier, data: CaseUpdate, repo: Repo):
    """Replace case fields/associations using the last observed updated_at timestamp."""
    return wire(repo.update_case(case_id, data))


@router.get("/cases/{case_id}/notes", response_model=Collection, tags=["Cases"])
def notes(case_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.notes(case_id, page))


@router.post("/cases/{case_id}/notes", status_code=201, tags=["Cases"])
def add_note(case_id: Identifier, data: NoteWrite, repo: Repo):
    return wire(repo.add_note(case_id, data.body))


@router.get("/cases/{case_id}/report", tags=["Reports"])
def report(case_id: Identifier, repo: Repo, page: Paging):
    return wire(repo.report(case_id, page))


@router.get("/audit", response_model=Collection, tags=["Reference"])
def audit(repo: Repo, page: Paging):
    return wire(repo.catalog("audit", page))


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = build_engine(settings)

    @asynccontextmanager
    async def lifespan(_app):
        yield
        if engine is not None:
            engine.dispose()

    app = FastAPI(
        title="SHADOWPRINT API",
        version="0.1.0",
        lifespan=lifespan,
        description="Investigation API for the verified SQL Server schema. "
        "A shared service key identifies a configured demo investigator; "
        "this is not multi-user authentication. Original records are read-only.",
    )
    app.state.settings = settings
    app.state.engine = engine
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
    )

    @app.exception_handler(DomainError)
    async def domain_error(_request, exc):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status == 401 else None
        return JSONResponse(status_code=exc.status, content={"detail": exc.detail}, headers=headers)

    @app.exception_handler(IntegrityError)
    async def integrity_error(_request, _exc):
        return JSONResponse(
            status_code=409, content={"detail": "Conflicting record or invalid database reference"}
        )

    @app.exception_handler(DBAPIError)
    @app.exception_handler(SQLAlchemyError)
    async def database_error(_request, _exc):
        # Do not expose credentials, SQL, parameters, or driver error strings.
        return JSONResponse(
            status_code=503, content={"detail": "Database unavailable or schema not ready"}
        )

    @app.get("/health/live", tags=["Health"])
    def live():
        return {"status": "ok"}

    @app.get("/health/ready", tags=["Health"])
    def ready():
        if settings.api_key is None:
            raise DomainError(503, "API access is not configured")
        check_ready(engine, settings.investigator_id)
        return {"status": "ready", "database": "sqlserver", "schema": "phase3"}

    app.include_router(router)
    return app
