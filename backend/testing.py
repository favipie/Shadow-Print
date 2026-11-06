"""Explicit disposable SQL Server fixtures. Never migrate/reseed shadowprint_db."""
import argparse
import re
from pathlib import Path
from uuid import uuid4
from sqlalchemy import text
from app.config import Settings
from app.db import create_db

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = Path(__file__).parent / ".test-output"


def check_name(name):
    if not re.fullmatch(r"shadowprint_test_[0-9a-f]{32}", name):
        raise ValueError("Refusing non-disposable database name")
    return name


def create_test_database():
    name = "shadowprint_test_" + uuid4().hex
    master = create_db(Settings(database="master"))
    with master.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(f"CREATE DATABASE [{name}]"))
    master.dispose()
    REGISTRY.mkdir(exist_ok=True)
    (REGISTRY / name).write_text(name, encoding="utf-8")
    db = create_db(Settings(database=name))
    try:
        with db.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            for filename in ("001_schema.sql", "002_views.sql", "003_procedures.sql", "004_seed.sql"):
                sql = (ROOT / "database/sqlserver" / filename).read_text(encoding="utf-8-sig")
                for batch in re.split(r"^GO\s*$", sql, flags=re.M | re.I):
                    if batch.strip():
                        conn.exec_driver_sql(batch)
            conn.exec_driver_sql("EXEC dbo.run_detection N'test-baseline'")
    except Exception:
        db.dispose()
        drop_test_database(name)
        raise
    db.dispose()
    return name


def drop_test_database(name):
    check_name(name)
    marker = REGISTRY / name
    if not marker.exists() or marker.read_text(encoding="utf-8") != name:
        raise ValueError("No ownership marker; cleanup refused")
    master = create_db(Settings(database="master"))
    with master.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        # Applies only to the uniquely named database created by this helper.
        conn.execute(text(f"ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE"))
        conn.execute(text(f"DROP DATABASE [{name}]"))
    master.dispose()
    marker.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create", "drop"])
    parser.add_argument("name", nargs="?")
    args = parser.parse_args()
    if args.action == "create":
        print(create_test_database())
    elif args.name:
        drop_test_database(args.name)
    else:
        parser.error("drop requires the exact owned disposable database name")
