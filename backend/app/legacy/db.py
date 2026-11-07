from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import URL, Engine
from .config import Settings, settings


def create_db(config: Settings) -> Engine:
    # Brace escaping is ODBC syntax, not SQL interpolation. Values are server-side configuration.
    def value(v: str) -> str:
        return "{" + v.replace("}", "}}") + "}"

    odbc = (
        f"DRIVER={value(config.driver)};SERVER={value(config.server)};"
        f"DATABASE={value(config.database)};Trusted_Connection=yes;Encrypt=yes;"
        f"TrustServerCertificate={'yes' if config.trust_certificate else 'no'};Connection Timeout=5;"
    )
    engine = create_engine(URL.create("mssql+pyodbc", query={"odbc_connect": odbc}), pool_pre_ping=True)

    @event.listens_for(engine, "connect")
    def configure(dbapi, _):
        dbapi.timeout = 30
        cursor = dbapi.cursor()
        cursor.execute("SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; "
                       "SET ANSI_WARNINGS ON; SET CONCAT_NULL_YIELDS_NULL ON; "
                       "SET ARITHABORT ON; SET NUMERIC_ROUNDABORT OFF; SET XACT_ABORT ON;")
        cursor.close()
        dbapi.commit()

    return engine


engine = create_db(settings)


def connectivity(db: Engine = engine) -> dict:
    """Read-only preflight; safe against the populated project database."""
    with db.connect() as conn:
        result = dict(conn.execute(text("SELECT DB_NAME() AS database_name, @@VERSION AS version, "
                                       "CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) AS server_name")).mappings().one())
        result["tables"] = conn.execute(text("SELECT name FROM sys.tables WHERE is_ms_shipped=0 ORDER BY name")).scalars().all()
        result["counts"] = dict(conn.execute(text("SELECT 'accounts' AS name, COUNT(*) AS n FROM dbo.accounts "
            "UNION ALL SELECT 'comments',COUNT(*) FROM dbo.comments "
            "UNION ALL SELECT 'labels',COUNT(*) FROM dbo.comment_labels "
            "UNION ALL SELECT 'findings',COUNT(*) FROM dbo.findings "
            "UNION ALL SELECT 'cases',COUNT(*) FROM dbo.investigations")).all())
        result["scores"] = dict(conn.execute(text("SELECT id,demo_score FROM dbo.v_account_scores ORDER BY id")).all())
        return result


if __name__ == "__main__":
    import json
    print(json.dumps(connectivity(), indent=2))
