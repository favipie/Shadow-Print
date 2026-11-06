"""Initialize only an explicitly named empty disposable SQL Server *_test database."""

from pathlib import Path

from pyodbc import Error as ODBCError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings
from app.db import build_engine
from app.errors import DomainError

SQL_DIRECTORY = Path(__file__).resolve().parent.parent / "database" / "sqlserver"


def statements(source: str):
    buffer = []
    for line in source.splitlines():
        if not line.strip() or line.lstrip().startswith("--"):
            continue
        if line.strip().upper() == "GO":
            if buffer:
                yield "\n".join(buffer)
                buffer = []
            continue
        buffer.append(line)
    if buffer:
        raise ValueError("Unterminated SQL statement")


def migrate(engine):
    with engine.connect() as conn:
        database = conn.scalar(text("SELECT DB_NAME()"))
        if not database.lower().endswith("_test"):
            raise RuntimeError(
                "Refusing application database; initialization is restricted to *_test databases"
            )
        if conn.execute(text("SELECT name FROM sys.tables")).first():
            raise RuntimeError("Refusing nonempty database; use a dedicated empty schema")
    connection = engine.raw_connection()
    try:
        with connection.cursor() as cursor:
            for filename in ("001_schema.sql", "002_detection.sql", "003_seed.sql"):
                for statement in statements((SQL_DIRECTORY / filename).read_text(encoding="utf-8")):
                    cursor.execute(statement)
                    while cursor.nextset():
                        pass
                connection.commit()
                print(f"Applied {filename}")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    engine = build_engine(Settings())
    if engine is None:
        raise SystemExit(
            "Set SHADOWPRINT_DATABASE_URL to a dedicated empty SQL Server *_test database"
        )
    try:
        migrate(engine)
    except (SQLAlchemyError, ODBCError, DomainError, RuntimeError, ValueError, OSError) as error:
        # Driver exceptions may contain connection information. Keep CLI failures safe.
        raise SystemExit(
            f"Migration failed ({type(error).__name__}). Check configuration and schema; DDL may be partially applied."
        ) from None
    finally:
        engine.dispose()
