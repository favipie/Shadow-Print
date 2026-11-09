import importlib.util
import json
import os
from pathlib import Path

import pytest
from app.legacy.config import Settings
from app.legacy.db import create_db
from testing import ROOT, create_test_database, drop_test_database

spec = importlib.util.spec_from_file_location("hosted_install", ROOT / "deploy/install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def sources():
    return installer.checked_sources(
        ROOT / "database/sqlserver", json.loads((ROOT / "deploy/manifest.json").read_text())
    )


def test_hosted_source_integrity():
    assert len(sources()[0]) == 4
    with pytest.raises(ValueError, match="digest"):
        installer.checked_sources(ROOT / "database/sqlserver", {})


@pytest.mark.integration
def test_disposable_install_rollback_backup_and_restore():
    if os.environ.get("SHADOWPRINT_RUN_DB_TESTS") != "1":
        pytest.skip("Requires an owned disposable SQL Server database")
    name = create_test_database(empty=True)
    engine = create_db(Settings(database=name))
    master = create_db(Settings(database="master"))
    backup = None
    try:
        conn = engine.raw_connection()
        try:
            conn.driver_connection.autocommit = True
            cur = conn.cursor()
            assert cur.execute("SELECT DB_NAME()").fetchval() == name
            sql, _ = sources()
            installer.execute(cur, "BEGIN TRANSACTION")
            installer.apply_sources(cur, sql)
            installer.execute(cur, "ROLLBACK")
            assert (
                cur.execute("SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0").fetchval() == 0
            )
            installer.execute(cur, "BEGIN TRANSACTION")
            installer.apply_sources(cur, sql)
            installer.execute(cur, "COMMIT")
            installer.execute(cur, "EXEC dbo.run_detection N'demo-install-v1'")
            installer.verify(cur)
        finally:
            conn.close()
        conn = master.raw_connection()
        try:
            conn.driver_connection.autocommit = True
            cur = conn.cursor()
            # SQL Server runs under a separate service account. Use its configured
            # backup directory and only the fixture's freshly generated filename.
            directory = cur.execute(
                "SELECT CONVERT(nvarchar(512),SERVERPROPERTY('InstanceDefaultBackupPath'))"
            ).fetchval()
            backup = str(Path(directory) / (name + ".bak"))
            installer.restore_rehearsal(conn, name, backup)
        finally:
            try:
                if backup:
                    cur.execute("EXEC master.sys.xp_delete_files ?", backup)
            finally:
                conn.close()
    finally:
        master.dispose()
        engine.dispose()
        drop_test_database(name)
