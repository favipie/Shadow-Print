import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import create_app
from app.config import Settings
from app.db import create_db
from testing import create_test_database, drop_test_database

HEADERS = {"X-Shadowprint-Client": "local-workspace"}


@pytest.fixture(scope="session")
def db():
    if os.environ.get("SHADOWPRINT_RUN_DB_TESTS") != "1":
        pytest.skip("Set SHADOWPRINT_RUN_DB_TESTS=1 to create an isolated SQL Server test database.")
    name = create_test_database()
    engine = create_db(Settings(database=name))
    yield engine, Settings(database=name)
    engine.dispose()
    drop_test_database(name)


@pytest.fixture
def client(db):
    engine, config = db
    with TestClient(create_app(engine, config), headers=HEADERS) as client:
        yield client
