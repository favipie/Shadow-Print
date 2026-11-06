"""Live SQL Server acceptance against a disposable database, never shadowprint_db."""

import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app.api import create_app
from app.config import Settings
from app.db import check_ready
from app.repository import Repository
from app.schemas import CaseWrite, ReviewWrite
from migrate import migrate

KEY = "sqlserver-test-key-" + "x" * 32
pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def database_api():
    url = os.getenv("SHADOWPRINT_TEST_DATABASE_URL")
    if not url:
        pytest.skip(
            "Set SHADOWPRINT_TEST_DATABASE_URL to a dedicated seeded SQL Server *_test database"
        )
    if not (make_url(url).database or "").endswith("_test"):
        pytest.fail("Integration suite only writes to explicitly named *_test databases")
    app = create_app(Settings(_env_file=None, database_url=url, api_key=KEY))
    check_ready(app.state.engine, "DEMO-ANALYST")
    with TestClient(app, headers={"Authorization": f"Bearer {KEY}"}) as client:
        yield client, app.state.engine


def test_real_seed_counts_scores_and_benign_controls(database_api):
    client, _ = database_api
    assert client.get("/health/ready").status_code == 200
    accounts = client.get("/api/v1/accounts").json()
    assert accounts["total"] == 9
    scores = {a["id"]: a["demo_score"] for a in accounts["items"]}
    assert scores == {
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
    comments = client.get("/api/v1/comments?limit=5&offset=2").json()
    assert comments["total"] == 28 and len(comments["items"]) == 5
    assert all(c["created_at"].endswith("Z") for c in comments["items"])
    assert client.get("/api/v1/comments?q=%25%27%20OR%201=1%20--").json()["total"] == 0
    item = client.get("/api/v1/comments/C-352").json()
    assert item["labels"][0]["label_method"] == "Authored label"
    assert item["provenance_id"] == "demo-v1"
    counts = client.get("/api/v1/overview").json()["counts"]
    assert int(counts["comments"]) == 28 and int(counts["labeled_comments"]) == 25


def test_real_coordination_window_and_device_controls(database_api):
    client, engine = database_api
    windows = client.get("/api/v1/coordination").json()
    assert windows["total"] == 1 and windows["items"][0]["anchor_id"] == "C-410"
    assert client.get("/api/v1/coordination/C-410/comments").json()["total"] == 3
    assert client.get("/api/v1/network").json()["total"] == 8
    assert client.get("/api/v1/accounts/A-007/logins").json()["items"][0]["device_id"] == "D-006"
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            conn.execute(
                text("UPDATE comments SET created_at='2026-10-18 14:32:36' WHERE id='C-412'")
            )
            assert conn.scalar(text("SELECT COUNT(*) FROM v_coordination_windows")) == 0
        finally:
            transaction.rollback()


def test_real_detection_persists_findings_and_rejects_duplicate_run(database_api):
    client, engine = database_api
    run_id = "test-" + uuid4().hex
    response = client.post("/api/v1/detection-runs", json={"id": run_id})
    assert response.status_code == 201, response.text
    findings = client.get(f"/api/v1/detection-runs/{run_id}/findings").json()
    assert findings["total"] == 11
    for finding in findings["items"]:
        result = client.get("/api/v1/findings/" + finding["id"]).json()
        assert result["evidence"]["total"] > 0
    assert client.post("/api/v1/detection-runs", json={"id": run_id}).status_code == 409
    with engine.connect() as conn:
        assert (
            conn.scalar(text("SELECT COUNT(*) FROM findings WHERE run_id=:id"), {"id": run_id})
            == 11
        )


def test_real_comment_to_case_review_report_and_persistence(database_api):
    client, engine = database_api
    response = client.post(
        "/api/v1/cases",
        json={"title": "API workflow test", "account_ids": ["A-007"], "evidence_ids": ["E-C-501"]},
    )
    assert response.status_code == 201, response.text
    case = response.json()
    case_id = case["id"]
    assert client.get("/api/v1/evidence/E-C-501").json()["record"]["id"] == "C-501"
    review = client.post(
        "/api/v1/comments/C-501/reviews",
        json={"reviewed": True, "reason": "Benign control inspected"},
    )
    assert review.status_code == 201
    assert client.get("/api/v1/comments/C-501").json()["reviewed"] is True
    assert (
        client.post(
            f"/api/v1/cases/{case_id}/notes",
            json={"body": "Shared library access does not establish identity."},
        ).status_code
        == 201
    )
    stale = {
        "title": "API workflow test",
        "status": "Closed",
        "decision": "Benign",
        "account_ids": ["A-007"],
        "evidence_ids": ["E-C-501"],
        "expected_updated_at": case["updated_at"],
    }
    assert client.put(f"/api/v1/cases/{case_id}", json=stale).status_code == 409
    stale["expected_updated_at"] = client.get(f"/api/v1/cases/{case_id}").json()["updated_at"]
    updated = client.put(f"/api/v1/cases/{case_id}", json=stale)
    assert updated.status_code == 200, updated.text
    report = client.get(f"/api/v1/cases/{case_id}/report").json()
    assert report["case"]["status"] == "Closed"
    assert report["evidence"]["items"][0]["comment_id"] == "C-501"
    assert client.get(f"/api/v1/cases/{case_id}/notes").json()["total"] == 1
    # Read through a fresh application/pool to demonstrate database persistence.
    second_app = create_app(
        Settings(
            _env_file=None, database_url=os.environ["SHADOWPRINT_TEST_DATABASE_URL"], api_key=KEY
        )
    )
    with TestClient(second_app, headers={"Authorization": f"Bearer {KEY}"}) as second:
        assert second.get(f"/api/v1/cases/{case_id}").json()["decision"] == "Benign"
    with engine.connect() as conn:
        assert (
            conn.scalar(
                text("SELECT COUNT(*) FROM audit_history WHERE investigation_id=:id"),
                {"id": case_id},
            )
            == 3
        )
    assert (
        client.post(
            "/api/v1/comments/C-501/reviews", json={"reviewed": False, "reason": "Restore control"}
        ).status_code
        == 201
    )


def test_real_unknown_links_roll_back_and_schema_is_not_overwritten(database_api):
    client, engine = database_api
    with engine.connect() as conn:
        before = conn.scalar(text("SELECT COUNT(*) FROM investigations"))
    response = client.post(
        "/api/v1/cases", json={"title": "Must not exist", "evidence_ids": ["missing"]}
    )
    assert response.status_code == 422
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT COUNT(*) FROM investigations")) == before
    with pytest.raises(RuntimeError, match="nonempty"):
        migrate(engine)


def test_real_audit_failure_rolls_back_case_and_review(database_api):
    _, engine = database_api
    invalid_actor = Repository(engine, "missing-actor")
    with engine.connect() as conn:
        case_count = conn.scalar(text("SELECT COUNT(*) FROM investigations"))
        review_count = conn.scalar(text("SELECT COUNT(*) FROM review_actions"))
    with pytest.raises(IntegrityError):
        invalid_actor.create_case(CaseWrite(title="Must roll back", account_ids=["A-001"]))
    with pytest.raises(IntegrityError):
        invalid_actor.review("C-501", ReviewWrite(reviewed=True, reason="Must roll back"))
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT COUNT(*) FROM investigations")) == case_count
        assert conn.scalar(text("SELECT COUNT(*) FROM review_actions")) == review_count
