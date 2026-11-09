import json
import secrets
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app import api, hosted
from app.config import Settings

KEY = "test-hosted-key-" + "x" * 32


def hosted_app(tmp_path, monkeypatch, engine=None):
    members = {}
    for username, role in (("alex", "investigator"), ("sam", "viewer"), ("root", "admin")):
        salt = secrets.token_bytes(16)
        actor = "DEMO-ANALYST" if username == "alex" else username.upper()
        members[username] = dict(
            actor=actor,
            role=role,
            salt=salt.hex(),
            digest=hosted.derive("demo password", salt).hex(),
        )
    file = tmp_path / "members.json"
    file.write_text(json.dumps(members))
    monkeypatch.setattr(api, "build_engine", lambda _: engine)
    return api.create_app(
        Settings(
            _env_file=None,
            mode="hosted",
            members_file=file,
            api_key=KEY,
            api_host="api.example.test",
            database_url="mssql+pyodbc://shadowprint_app@db:1433/shadowprint_demo?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no",
        )
    )


def client(app):
    return TestClient(
        app, base_url="https://api.example.test", headers={"Authorization": "Bearer " + KEY}
    )


def login(c, user):
    result = c.post("/session/login", json={"username": user, "password": "demo password"})
    assert result.status_code == 200
    return {"X-Shadowprint-Session": result.json()["token"]}


def test_hosted_boundary(tmp_path, monkeypatch):
    with client(hosted_app(tmp_path, monkeypatch)) as c:
        assert c.get("/health/live").status_code == 200
        assert c.get("/session", headers={"authorization": "Bearer wrong"}).status_code == 401
        assert (
            c.post("/session/login", json={"username": "alex", "password": "wrong"}).status_code
            == 401
        )
        assert c.post("/session/login", content="a" * 5000).status_code == 413
        assert (
            c.get("/api/workspace", headers={"X-Shadowprint-Actor": "DEMO-ANALYST"}).status_code
            == 401
        )
        member = login(c, "sam")
        for path in (
            "/api/cases",
            "/api/v1/cases",
            "/api/detection/runs",
            "/api/v1/detection-runs",
        ):
            assert c.post(path, headers=member, json={}).status_code == 403
        assert c.get("/session", headers=member).json() == {"investigator": "SAM", "role": "viewer"}
        assert c.get("/session", headers={**member, "host": "invalid.example"}).status_code == 400
        assert c.delete("/session", headers=member).status_code == 200
        assert c.get("/session", headers=member).status_code == 401
        member = login(c, "alex")
        assert c.post("/api/v1/detection-runs", headers=member, json={}).status_code == 403
        assert c.post("/api/cases", headers=member, content=b"x" * 100_001).status_code == 413
        member = login(c, "alex")
        monkeypatch.setattr(hosted, "time", SimpleNamespace(monotonic=lambda: 10**15))
        assert c.get("/session", headers=member).status_code == 401


def test_rate_limit(tmp_path, monkeypatch):
    with client(hosted_app(tmp_path, monkeypatch)) as c:
        for _ in range(20):
            assert c.post("/session/login", content=b"{}").status_code == 400
        assert c.post("/session/login", content=b"{}").status_code == 429


def test_hosted_sql_case_review_and_legacy_actor(db, tmp_path, monkeypatch):
    engine, _ = db
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO dbo.investigators VALUES ('ROOT','Demo admin'),('SAM','Demo observer')"
            )
        )
    with client(hosted_app(tmp_path, monkeypatch, engine)) as c:
        member = login(c, "root")
        assert c.get("/health/ready").status_code == 200
        assert c.get("/api/workspace", headers=member).status_code == 200
        result = c.post(
            "/api/v1/cases",
            headers=member,
            json={"title": "Hosted demo", "evidence_ids": ["E-C-352"]},
        )
        assert result.status_code == 201, result.text
        case = result.json()["id"]
        legacy = {**member, "X-Shadowprint-Client": "local-workspace", "X-Shadowprint-Actor": "SAM"}
        note = c.post(
            f"/api/cases/{case}/notes", headers=legacy, json={"text": "synthetic investigator note"}
        )
        assert note.status_code == 201, note.text
        assert c.get(f"/api/reports/{case}?format=csv", headers=member).status_code == 200
        with engine.connect() as conn:
            actors = (
                conn.execute(
                    text(
                        "SELECT investigator_id FROM dbo.audit_history WHERE investigation_id=:case"
                    ),
                    {"case": case},
                )
                .scalars()
                .all()
            )
            assert actors == ["ROOT", "ROOT"]
