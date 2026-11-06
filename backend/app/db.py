import re

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine

from .config import Settings
from .errors import DomainError


def check_version(version: str) -> None:
    match = re.match(r"(\d+)\.(\d+)\.(\d+)", version)
    if not match or int(match.group(1)) < 17:
        raise DomainError(503, "SQL Server 2025 or newer is required by the verified schema")


def build_engine(settings: Settings) -> Engine | None:
    if settings.database_url is None:
        return None
    engine = create_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=5,
        max_overflow=5,
        pool_timeout=10,
        hide_parameters=True,
        connect_args={"timeout": 10},
    )

    @event.listens_for(engine, "connect")
    def configure(dbapi_connection, _record):
        with dbapi_connection.cursor() as cursor:
            dbapi_connection.timeout = 30
            cursor.execute("SELECT CONVERT(varchar(128),SERVERPROPERTY('ProductVersion'))")
            check_version(cursor.fetchone()[0])
            cursor.execute("SET XACT_ABORT ON; SET NOCOUNT ON;")

    return engine


def check_ready(engine: Engine | None, investigator_id: str) -> None:
    if engine is None:
        raise DomainError(503, "Database is not configured")
    with engine.connect() as conn:
        for name in (
            "provenance",
            "accounts",
            "posts",
            "comments",
            "devices",
            "login_events",
            "interactions",
            "label_types",
            "comment_labels",
            "detection_rules",
            "detection_runs",
            "findings",
            "evidence",
            "finding_evidence",
            "investigators",
            "investigations",
            "investigation_accounts",
            "investigation_evidence",
            "investigation_findings",
            "case_notes",
            "review_actions",
            "audit_history",
            "v_latest_reviews",
            "v_account_scores",
            "v_detection_evidence",
            "v_coordination_windows",
        ):
            conn.execute(text(f"SELECT TOP (0) * FROM dbo.{name}"))
        actor = conn.scalar(
            text("SELECT id FROM investigators WHERE id=:id"), {"id": investigator_id}
        )
        if actor is None:
            raise DomainError(503, "Configured investigator is missing from the database")
        routine = conn.scalar(
            text(
                "SELECT COUNT(*) FROM sys.procedures WHERE name='run_detection' AND schema_id=SCHEMA_ID('dbo')"
            )
        )
        if not routine:
            raise DomainError(503, "Detection procedure is missing")
