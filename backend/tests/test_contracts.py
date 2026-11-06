from datetime import UTC, datetime

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
    with pytest.raises(ValidationError):
        Settings(_env_file=None, api_key="short")
    settings = Settings(
        _env_file=None,
        database_url="mssql+pyodbc://user:private-password@127.0.0.1/demo?driver=ODBC+Driver+18+for+SQL+Server",
    )
    assert "private-password" not in repr(settings)


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
    schema = list(statements((SQL_DIRECTORY / "001_schema.sql").read_text()))
    assert sum(s.startswith("CREATE TABLE") for s in schema) == 22
    detection = list(statements((SQL_DIRECTORY / "002_detection.sql").read_text()))
    procedures = [s for s in detection if s.startswith("CREATE OR ALTER PROCEDURE")]
    assert len(procedures) == 3
    assert all("ROLLBACK" in s and "THROW" in s for s in procedures)
    seed = list(statements((SQL_DIRECTORY / "003_seed.sql").read_text()))
    assert "BEGIN TRANSACTION" in seed[0] and "COMMIT" in seed[0]
    assert seed[0].count("INSERT INTO dbo.[comments] ") == 28


def test_parser_refuses_truncated_sql():
    with pytest.raises(ValueError):
        list(statements("CREATE TABLE missing"))
