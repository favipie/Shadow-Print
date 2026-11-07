from datetime import UTC, datetime
import re

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.db import check_version
from app.errors import DomainError
from app.repository import comment_where, literal_like
from app.schemas import CommentFilter, wire
from migrate import SQL_DIRECTORY, statements


def test_settings_require_sqlserver_and_hide_secrets():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url="sqlite:///demo.db")
    settings = Settings(
        _env_file=None,
        database_url="mssql+pyodbc://user:private-password@127.0.0.1/demo?driver=ODBC+Driver+18+for+SQL+Server",
    )
    assert "private-password" not in repr(settings)


@pytest.mark.parametrize("key", ["", "short", " " * 40, "replace-with-the-same-generated-server-only-key"])
def test_empty_short_and_example_keys_are_rejected(key):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, api_key=key)


@pytest.mark.parametrize("version", ["5.7.44", "8.0.15", "10.11.1-MariaDB", "unknown"])
def test_reject_incompatible_database(version):
    with pytest.raises(DomainError):
        check_version(version)


@pytest.mark.parametrize("version", ["17.0.1000.7", "17.0.2000.1", "18.0.1"])
def test_accept_sqlserver_versions(version):
    check_version(version)


def test_search_is_bound_and_wildcards_are_literal():
    hostile = "%' OR 1=1 --_!"
    where, params = comment_where(CommentFilter(q=hostile, reviewed=False))
    assert hostile not in where
    assert params["q"] == literal_like(hostile)
    assert "!%" in params["q"] and "!_" in params["q"]
    assert "COALESCE(r.reviewed,0)" in where


def test_date_filter_converts_to_naive_utc():
    _, params = comment_where(CommentFilter(since="2026-10-18T13:30:00+05:30"))
    assert params["since"] == datetime(2026, 10, 18, 8)
    assert wire({"at": datetime(2026, 10, 18, tzinfo=UTC)}) == {"at": "2026-10-18T00:00:00.000Z"}


def test_existing_migrations_are_parsed_without_splitting_procedures():
    schema = (SQL_DIRECTORY / "001_schema.sql").read_text(encoding="utf-8-sig")
    assert len(re.findall(r"CREATE TABLE dbo\.\w+", schema)) == 22
    sql = (SQL_DIRECTORY / "003_procedures.sql").read_text(encoding="utf-8-sig")
    procedures = [s for s in re.split(r"^GO\s*$", sql, flags=re.M | re.I) if s.strip().startswith("CREATE PROCEDURE")]
    assert len(procedures) == 3
    assert all("ROLLBACK" in s and "THROW" in s for s in procedures)
    seed = (SQL_DIRECTORY / "004_seed.sql").read_text(encoding="utf-8-sig")
    assert "BEGIN TRANSACTION" in seed and "COMMIT" in seed
    assert seed.count("INSERT INTO dbo.comments ") == 28


def test_parser_refuses_truncated_sql():
    with pytest.raises(ValueError):
        list(statements("CREATE TABLE missing"))
