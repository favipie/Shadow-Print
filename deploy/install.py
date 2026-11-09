"""One-shot synthetic installation and restore rehearsal for the private Compose database."""

import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from uuid import uuid4

import pyodbc

SQL = Path("/srv/sql")
MANIFEST = Path("/srv/manifest.json")
FILES = ("001_schema.sql", "002_views.sql", "003_procedures.sql", "004_seed.sql")
NAME = "shadowprint_demo"


def checked_sources(directory, manifest):
    sources = [
        (directory / filename).read_text(encoding="utf-8-sig") for filename in FILES
    ]
    actual = {
        name: hashlib.sha256(src.encode()).hexdigest()
        for name, src in zip(FILES, sources)
    }
    if actual != manifest:
        raise ValueError("Reviewed SQL digest mismatch")
    return sources, hashlib.sha256(
        json.dumps(actual, sort_keys=True).encode()
    ).hexdigest()


def execute(cur, sql, *params):
    cur.execute(sql, *params)
    while cur.nextset():
        pass


def apply_sources(cur, sources):
    for source in sources:
        for batch in re.split(r"^GO\s*$", source, flags=re.I | re.M):
            if batch.strip():
                execute(cur, batch)


def connect(database):
    if database not in {"master", NAME}:
        raise ValueError("Unexpected installation target")
    pw = os.environ["INSTALL_PASSWORD"].replace("}", "}}")
    dsn = (
        "DRIVER={ODBC Driver 18 for SQL Server};SERVER=tcp:db,1433;DATABASE="
        + database
        + ";Encrypt=yes;TrustServerCertificate=no;UID=sa;PWD={"
        + pw
        + "}"
    )
    for attempt in range(12):
        try:
            conn = pyodbc.connect(dsn, autocommit=True, timeout=3)
            break
        except pyodbc.Error:
            if attempt == 11:
                raise RuntimeError("Private SQL connection failed") from None
            time.sleep(2)
    cur = conn.cursor()
    row = cur.execute(
        "SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),DB_NAME(),CONVERT(int,SERVERPROPERTY('ProductMajorVersion'))"
    ).fetchone()
    if row[0].lower() != "shadowprint-db" or row[1] != database or row[2] < 17:
        raise RuntimeError("Unexpected SQL Server instance, version or database")
    return conn


def bootstrap():
    sources, digest = checked_sources(SQL, json.loads(MANIFEST.read_text()))
    password = os.environ["APP_PASSWORD"]
    if not re.fullmatch(r"[A-Za-z0-9_!\-]{32,128}", password):
        raise ValueError("Invalid generated runtime password")
    members = json.loads(Path("/run/demo/members.json").read_text())
    master = connect("master")
    try:
        execute(
            master.cursor(),
            "IF DB_ID(N'shadowprint_demo') IS NULL CREATE DATABASE [shadowprint_demo]",
        )
    finally:
        master.close()
    conn = connect(NAME)
    cur = conn.cursor()
    try:
        execute(
            cur,
            "SET XACT_ABORT ON; SET ARITHABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_WARNINGS ON; SET ANSI_PADDING ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF; BEGIN TRANSACTION",
        )
        execute(
            cur,
            "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='shadowprint_install',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; IF @r<0 THROW 51000,'Installation busy',1",
        )
        mark = cur.execute(
            "SELECT CONVERT(varchar(64),value) FROM sys.extended_properties WHERE class=0 AND name='shadowprint_manifest_v1'"
        ).fetchone()
        if mark is None:
            if cur.execute(
                "SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped=0 AND type IN ('U','V','P','FN','TF','IF')"
            ).fetchval():
                raise RuntimeError("Refusing nonempty unmarked database")
            apply_sources(cur, sources)
            for member in members.values():
                actor = member["actor"]
                execute(
                    cur,
                    "IF NOT EXISTS(SELECT 1 FROM dbo.investigators WHERE id=?) INSERT dbo.investigators(id,display_name) VALUES (?,?)",
                    actor,
                    actor,
                    actor,
                )
            # Input restricted to generated characters above. DDL does not accept password binds.
            execute(
                cur,
                "CREATE LOGIN shadowprint_app WITH PASSWORD='"
                + password
                + "',CHECK_POLICY=ON",
            )
            execute(cur, "CREATE USER shadowprint_app FOR LOGIN shadowprint_app")
            execute(cur, "ALTER ROLE db_datareader ADD MEMBER shadowprint_app")
            for table in (
                "investigations",
                "investigation_accounts",
                "investigation_evidence",
                "investigation_findings",
                "case_notes",
                "review_actions",
                "audit_history",
            ):
                perms = "INSERT"
                if table == "investigations":
                    perms += ", UPDATE"
                if table.startswith("investigation_"):
                    perms += ", DELETE"
                execute(cur, f"GRANT {perms} ON dbo.{table} TO shadowprint_app")
            for proc in ("run_detection", "review_comment", "change_case_status"):
                execute(cur, f"GRANT EXECUTE ON dbo.{proc} TO shadowprint_app")
            execute(
                cur,
                "EXEC sys.sp_addextendedproperty @name=N'shadowprint_manifest_v1',@value=?",
                digest,
            )
        elif mark[0] != digest:
            raise RuntimeError(
                "Existing schema version differs; reviewed upgrade required"
            )
        execute(cur, "COMMIT")
        if not cur.execute(
            "SELECT 1 FROM dbo.detection_runs WHERE id=N'demo-install-v1'"
        ).fetchone():
            execute(cur, "EXEC dbo.run_detection N'demo-install-v1'")
        verify(cur)
    except BaseException:
        execute(cur, "IF XACT_STATE()<>0 ROLLBACK")
        raise
    finally:
        conn.close()


def verify(cur):
    for query, expected in [
        ("SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0", 22),
        ("SELECT COUNT(*) FROM dbo.accounts", 9),
        ("SELECT COUNT(*) FROM dbo.comments", 28),
        ("SELECT COUNT(*) FROM dbo.comment_labels", 25),
        ("SELECT COUNT(*) FROM dbo.provenance WHERE kind <> 'synthetic'", 0),
        (
            "SELECT COUNT(*) FROM sys.procedures WHERE object_id IN (OBJECT_ID('dbo.run_detection'),OBJECT_ID('dbo.review_comment'),OBJECT_ID('dbo.change_case_status'))",
            3,
        ),
        ("SELECT COUNT(*) FROM dbo.findings WHERE run_id='demo-install-v1'", 11),
        (
            "SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1",
            0,
        ),
        (
            "SELECT COUNT(*) FROM sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1",
            0,
        ),
    ]:
        if cur.execute(query).fetchval() != expected:
            raise RuntimeError("Synthetic baseline verification failed")
    expected = {
        "A-001": 30,
        "A-002": 55,
        "A-003": 50,
        "A-004": 25,
        "A-005": 0,
        "A-006": 25,
        "A-007": 0,
        "A-008": 0,
        "U-021": 0,
    }
    if (
        dict(cur.execute("SELECT id,demo_score FROM dbo.v_account_scores").fetchall())
        != expected
    ):
        raise RuntimeError("Synthetic scores differ from the verified fixture")
    execute(
        cur,
        "BEGIN TRANSACTION; UPDATE dbo.investigations SET description='ROLLBACK-REHEARSAL' WHERE id=N'SP-0098'; ROLLBACK",
    )
    if cur.execute(
        "SELECT COUNT(*) FROM dbo.investigations WHERE id=N'SP-0098' AND description='ROLLBACK-REHEARSAL'"
    ).fetchval():
        raise RuntimeError("Rollback verification failed")


def restore_rehearsal(conn, source, backup):
    if source != NAME and not re.fullmatch(r"shadowprint_test_[0-9a-f]{32}", source):
        raise ValueError("Unsafe backup source")
    cur = conn.cursor()
    dst = "shadowprint_restore_" + uuid4().hex
    if cur.execute("SELECT DB_ID(?)", dst).fetchval() is not None:
        raise RuntimeError("Restore target exists")
    files = list(
        cur.execute(
            "SELECT name,type FROM sys.master_files WHERE database_id=DB_ID(?) ORDER BY file_id",
            source,
        )
    )
    if sorted(kind for _, kind in files) != [0, 1]:
        raise RuntimeError("Expected one data file and one log file")
    execute(
        cur, f"BACKUP DATABASE [{source}] TO DISK=? WITH COPY_ONLY,CHECKSUM", backup
    )
    execute(cur, "RESTORE VERIFYONLY FROM DISK=? WITH CHECKSUM", backup)
    moves = []
    for logical, kind in files:
        prop = "InstanceDefaultLogPath" if kind else "InstanceDefaultDataPath"
        folder = cur.execute(
            f"SELECT CONVERT(nvarchar(512),SERVERPROPERTY('{prop}'))"
        ).fetchval()
        separator = "/" if folder.startswith("/") else chr(92)
        path = folder.rstrip(separator) + separator + dst + (".ldf" if kind else ".mdf")
        moves.append(
            "MOVE '"
            + logical.replace("'", "''")
            + "' TO '"
            + path.replace("'", "''")
            + "'"
        )
    execute(
        cur,
        f"RESTORE DATABASE [{dst}] FROM DISK=? WITH CHECKSUM," + ",".join(moves),
        backup,
    )
    try:
        execute(cur, f"USE [{dst}]")
        verify(cur)
    finally:
        execute(cur, "USE master")
        execute(cur, f"DROP DATABASE [{dst}]")


def recovery():
    conn = connect("master")
    backup = "/var/opt/mssql/data/demo-" + uuid4().hex + ".bak"
    try:
        restore_rehearsal(conn, NAME, backup)
        print("Verified backup and isolated restore:", backup)
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["bootstrap"]:
            bootstrap()
        elif sys.argv[1:] == ["recovery"]:
            recovery()
        else:
            sys.exit("Choose bootstrap or recovery")
    except pyodbc.Error as exc:
        # Never print administrative SQL or driver exceptions containing secrets.
        sys.exit(
            "Database operation failed (SQLSTATE "
            + str(exc.args[0])[:5]
            + "). Inspect private SQL Server diagnostics."
        )
    print("Completed successfully")
