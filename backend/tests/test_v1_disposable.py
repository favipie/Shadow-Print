"""Canonical API checks, using only the owned database fixture."""
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import pytest
from app import api
from app.config import Settings
from app.repository import Repository
from app.schemas import CaseWrite

KEY = "test-only-key-" + "x" * 32


def test_v1_case_lifecycle_and_atomic_rollback(db, monkeypatch):
    engine, _ = db
    monkeypatch.setattr(api, "build_engine", lambda settings: engine)
    app = api.create_app(Settings(_env_file=None, api_key=KEY))
    with TestClient(app, headers={"Authorization": f"Bearer {KEY}"}) as client:
        workspace = client.get("/api/workspace")
        assert workspace.status_code == 200
        assert workspace.json()["settings"]["database"] == client.get("/api/health").json()["database"]
        assert workspace.json()["settings"]["database"].startswith("shadowprint_test_")
        assert client.get("/api/v1/accounts", headers={"Authorization": "Bearer wrong"}).status_code == 401
        assert client.get("/api/workspace", headers={"Authorization": "Bearer wrong"}).status_code == 401
        created = client.post("/api/v1/cases", json={"title": "Disposable v1 case", "account_ids": ["A-001"], "evidence_ids": ["E-C-352"]})
        assert created.status_code == 201, created.text
        case = created.json()
        update = {"title": case["title"], "status": "Closed", "decision": "Reviewed", "account_ids": ["A-001"], "evidence_ids": ["E-C-352"], "expected_updated_at": case["updated_at"]}
        response = client.put(f"/api/v1/cases/{case['id']}", json=update)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "Closed"
        assert client.put(f"/api/v1/cases/{case['id']}", json=update).status_code == 409
        with engine.connect() as conn:
            before = conn.scalar(text("SELECT COUNT(*) FROM investigations"))
            assert conn.scalar(text("SELECT COUNT(*) FROM audit_history WHERE investigation_id=:id"), {"id": case["id"]}) == 2
        bad = client.post("/api/v1/cases", json={"title": "Must roll back", "evidence_ids": ["missing"]})
        assert bad.status_code == 422
        with engine.connect() as conn:
            assert conn.scalar(text("SELECT COUNT(*) FROM investigations")) == before
        with pytest.raises(IntegrityError):
            Repository(engine, "missing-investigator").create_case(CaseWrite(title="Audit must fail", account_ids=["A-001"]))
        with engine.connect() as conn:
            assert conn.scalar(text("SELECT COUNT(*) FROM investigations")) == before
