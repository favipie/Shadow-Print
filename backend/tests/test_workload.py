import importlib.util
import os
from pathlib import Path
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from app.config import Settings
from app.db import create_db
from testing import create_test_database, drop_test_database

path = Path(__file__).resolve().parents[2] / "database/sqlserver/generate.py"
spec = importlib.util.spec_from_file_location("tsql_workload", path)
workload = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workload)


def test_workload_determinism_and_inputs():
    assert workload.generate(30, 42) == workload.generate(30, 42)
    assert workload.generate(30, 42) != workload.generate(30, 43)
    assert workload.literal("O'Brien") == "N'O''Brien'"
    for extra, seed in [(-1, 42), (100001, 42), (1.5, 42), (10, -1), (10, 2**32)]:
        with pytest.raises(ValueError):
            workload.generate(extra, seed)


def test_tsql_workload_execution():
    if os.environ.get("SHADOWPRINT_RUN_DB_TESTS") != "1":
        pytest.skip("Requires an owned disposable SQL Server database")
    name = create_test_database()
    db = create_db(Settings(database=name))
    try:
        with db.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            original = list(conn.execute(text("SELECT * FROM dbo.comments ORDER BY id")))
            scores = dict(conn.exec_driver_sql("SELECT * FROM dbo.v_account_scores").fetchall())
            conn.exec_driver_sql(workload.generate(30, 42))
            assert conn.exec_driver_sql("SELECT COUNT(*) FROM dbo.comments").scalar_one() == 76
            assert conn.exec_driver_sql("SELECT COUNT(*) FROM dbo.accounts").scalar_one() == 21
            assert conn.exec_driver_sql("SELECT COUNT(*) FROM dbo.comment_labels").scalar_one() == 43
            assert list(conn.exec_driver_sql("SELECT * FROM dbo.comments WHERE provenance_id='demo-v1' ORDER BY id")) == original
            current = dict(conn.exec_driver_sql("SELECT * FROM dbo.v_account_scores").fetchall())
            assert {key: current[key] for key in scores} == scores
            assert {key: value for key, value in current.items() if key.startswith('SG-')} == {
                f"SG-{i:06d}": {0:25, 1:25, 2:20, 3:30, 4:30, 5:30}.get(i, 0) for i in range(12)
            }
            conn.exec_driver_sql("EXEC dbo.run_detection N'workload-verification'")
            assert conn.exec_driver_sql("SELECT COUNT(*) FROM dbo.findings WHERE run_id='workload-verification'").scalar_one() == 20
            # Coordination includes exactly 90 seconds; shifting the final participant to 91 excludes it.
            conn.exec_driver_sql("BEGIN TRANSACTION")
            try:
                conn.exec_driver_sql("UPDATE dbo.comments SET created_at=DATEADD(SECOND,1,created_at) WHERE author_id='SG-000005'")
                assert conn.exec_driver_sql("SELECT COUNT(*) FROM dbo.v_coordination_windows WHERE anchor_id LIKE 'SGC-%'").scalar_one() == 0
            finally:
                conn.exec_driver_sql("ROLLBACK")
            with pytest.raises(DBAPIError):
                conn.exec_driver_sql(workload.generate(30, 42))
            assert conn.exec_driver_sql("SELECT COUNT(*) FROM dbo.comments").scalar_one() == 76
            assert conn.exec_driver_sql("SELECT @@TRANCOUNT").scalar_one() == 0
    finally:
        db.dispose()
        drop_test_database(name)
