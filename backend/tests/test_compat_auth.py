from unittest.mock import Mock

from fastapi.testclient import TestClient

from app import api
from app.config import Settings


def test_legacy_routes_require_same_service_key(monkeypatch):
    engine = Mock()
    monkeypatch.setattr(api, "build_engine", lambda settings: engine)
    key = "test-only-service-key-" + "x" * 32
    app = api.create_app(Settings(_env_file=None, api_key=key))
    with TestClient(app) as client:
        for path in ("/api/workspace", "/api/reports/SP-1", "/api/cases"):
            assert client.get(path).status_code == 401
            assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 401
        assert client.post("/api/cases", headers={"X-Shadowprint-Client": "local-workspace"}, json={}).status_code == 401
        assert client.post("/api/cases", headers={"Authorization": f"Bearer {key}"}, json={}).status_code == 403
    engine.connect.assert_not_called()


def test_legacy_routes_fail_closed_without_key(monkeypatch):
    monkeypatch.setattr(api, "build_engine", lambda settings: Mock())
    app = api.create_app(Settings(_env_file=None))
    with TestClient(app) as client:
        assert client.get("/api/workspace").status_code == 503
