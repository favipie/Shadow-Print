from datetime import UTC, datetime
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api import create_app, get_repository
from app.config import Settings
from app.errors import DomainError

KEY = "test-only-key-" + "x" * 32


@pytest.fixture
def api():
    app = create_app(Settings(_env_file=None, api_key=KEY))
    repo = Mock()
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app, headers={"Authorization": f"Bearer {KEY}"}) as client:
        yield client, repo


def test_unconfigured_app_is_live_but_not_ready():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        assert client.get("/health/live").json() == {"status": "ok"}
        assert client.get("/health/ready").status_code == 503
        assert client.get("/api/v1/accounts").status_code == 503
        assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize("authorization", ["", "Bearer wrong", "Basic not-valid"])
def test_service_key_required(api, authorization):
    client, repo = api
    response = client.get("/api/v1/accounts", headers={"Authorization": authorization})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    repo.accounts.assert_not_called()


def test_account_search_and_pagination(api):
    client, repo = api
    repo.accounts.return_value = {"items": [], "total": 0, "limit": 2, "offset": 3}
    response = client.get("/api/v1/accounts?q=echo&provenance_id=demo-v1&limit=2&offset=3")
    assert response.status_code == 200, response.text
    page, q, provenance = repo.accounts.call_args.args
    assert (page.limit, page.offset, q, provenance) == (2, 3, "echo", "demo-v1")


def test_comments_pass_source_filters_and_utc_dates(api):
    client, repo = api
    repo.comments.return_value = {
        "items": [{"id": "C-501", "created_at": datetime(2026, 10, 17, 9)}],
        "total": 1,
        "limit": 50,
        "offset": 0,
    }
    response = client.get(
        "/api/v1/comments",
        params={
            "account_id": "A-007",
            "reviewed": "false",
            "since": "2026-10-17T10:00:00+01:00",
            "label_method": "Rule example",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["items"][0]["created_at"] == "2026-10-17T09:00:00.000Z"
    filters = repo.comments.call_args.args[0]
    assert filters.account_id == "A-007" and filters.reviewed is False
    assert filters.since.astimezone(UTC).hour == 9


@pytest.mark.parametrize(
    "query",
    [
        "limit=0",
        "limit=101",
        "offset=-1",
        "since=2026-10-17T00:00:00",
        "since=2026-10-18T00:00:00Z&until=2026-10-17T00:00:00Z",
        "label_method=Prediction",
        "unexpected=value",
    ],
)
def test_invalid_filters_rejected_before_repository(api, query):
    client, repo = api
    assert client.get("/api/v1/comments?" + query).status_code == 422
    repo.comments.assert_not_called()


@pytest.mark.parametrize(
    "payload",
    [
        {"title": " "},
        {"title": "Review", "status": "Closed"},
        {"title": "Review", "status": "Resolved", "decision": "  "},
        {"title": "Review", "account_ids": ["A-001", "A-001"]},
        {"title": "Review", "account_ids": ["' OR 1=1 --"]},
        {"title": "Review", "actor": "forged-identity"},
        {"title": "Review", "status": "Deleted"},
    ],
)
def test_invalid_cases_rejected(api, payload):
    client, repo = api
    assert client.post("/api/v1/cases", json=payload).status_code == 422
    repo.create_case.assert_not_called()


def test_case_creation_and_optimistic_conflict(api):
    client, repo = api
    repo.create_case.return_value = {"id": "SP-test", "updated_at": datetime(2026, 10, 18)}
    response = client.post("/api/v1/cases", json={"title": "Review", "evidence_ids": ["E-C-501"]})
    assert response.status_code == 201
    assert response.json()["updated_at"].endswith("Z")
    repo.update_case.side_effect = DomainError(409, "Case changed; reload it before saving")
    response = client.put(
        "/api/v1/cases/SP-test",
        json={"title": "Review", "expected_updated_at": "2026-10-18T00:00:00Z"},
    )
    assert response.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"reviewed": "true", "reason": "Review"},
        {"reviewed": True, "reason": " "},
        {"reviewed": True, "reason": "Review", "investigator_id": "forged"},
    ],
)
def test_review_validation(api, payload):
    client, repo = api
    assert client.post("/api/v1/comments/C-501/reviews", json=payload).status_code == 422
    repo.review.assert_not_called()


def test_missing_record_and_database_errors_are_safe(api):
    client, repo = api
    repo.comment.side_effect = DomainError(404, "Record not found")
    assert client.get("/api/v1/comments/missing").status_code == 404
    repo.comment.side_effect = OperationalError("secret SQL", {}, Exception("password=secret"))
    response = client.get("/api/v1/comments/C-501")
    assert response.status_code == 503
    assert "secret" not in response.text
    repo.run_detection.side_effect = IntegrityError("secret SQL", {}, Exception("duplicate"))
    assert client.post("/api/v1/detection-runs", json={"id": "existing"}).status_code == 409


def test_cors_only_allows_configured_frontend(api):
    client, _ = api
    headers = {
        "Origin": "http://127.0.0.1:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    }
    assert client.options("/api/v1/cases", headers=headers).status_code == 200
    headers["Origin"] = "https://untrusted.example"
    assert client.options("/api/v1/cases", headers=headers).status_code == 400


def test_openapi_documents_service_auth_and_case_contract(api):
    client, _ = api
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/api/v1/cases"]["post"]["security"] == [{"HTTPBearer": []}]
    assert "expected_updated_at" in schema["components"]["schemas"]["CaseUpdate"]["required"]
