import csv
import io
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text
from app.schemas import CaseCreate, ReviewInput
from app.main import create_app
from app.reports import csv_report, html_report

CASE = {"title": "API workflow", "description": "Inspect original supporting evidence.", "accountIds": ["A-003"], "commentIds": ["C-352"]}


def test_input_validation():
    with pytest.raises(ValidationError):
        CaseCreate(**CASE, status="Closed")
    with pytest.raises(ValidationError):
        ReviewInput(reviewed="true", reason="test")
    with pytest.raises(ValidationError):
        CaseCreate(**{**CASE, "accountIds": [], "commentIds": []})
    with pytest.raises(ValidationError):
        ReviewInput(reviewed=True, reason="  ", actor="spoofed")


def test_browser_write_guard():
    with TestClient(create_app()) as client:
        assert client.post("/api/detection/runs").status_code == 403
        assert client.post("/api/detection/runs", headers={"X-Shadowprint-Client": "local-workspace", "Origin": "https://evil.example"}).status_code == 403
        assert client.get("/api/health", headers={"Host": "evil.example"}).status_code == 400


def test_report_escaping():
    case = {**CASE, "id": "test", "title": "=DANGEROUS()", "status": "Open", "updatedAt": "2026-11-05", "decision": "<script>alert(1)</script>", "notes": [{"text": 'quote,\nline "two"', "at": "now"}]}
    result = list(csv.reader(io.StringIO(csv_report(case, []).lstrip("\ufeff"))))
    assert result[1][1] == "'=DANGEROUS()"
    assert 'quote,\nline "two"' in result[1][5]
    html = html_report(case, [], [])
    assert "<script>" not in html and "&lt;script&gt;" in html


def test_connectivity_and_baseline(client):
    health = client.get("/api/health").json()
    assert health["database"].startswith("shadowprint_test_")
    assert health["tables"] == 22
    d = client.get("/api/workspace").json()
    assert len(d["profiles"]) == 9 and len(d["comments"]) == 28
    assert sum(len(c["annotations"]) for c in d["comments"]) == 25
    assert {p["id"]: p["score"] for p in d["profiles"]} == {
        "A-001":30, "A-002":55, "A-003":50, "A-004":25, "A-005":0, "A-006":25, "A-007":0, "A-008":0, "U-021":0}
    assert len(d["findings"]) == 11
    assert sum(len(f["commentIds"]) for f in d["findings"]) == 53


def test_all_read_endpoints(client):
    for path in ["/api/dashboard", "/api/accounts", "/api/accounts/A-003", "/api/comments", "/api/comments/C-352",
                 "/api/network", "/api/coordination", "/api/evidence/C-352", "/api/evidence/L-1", "/api/findings",
                 "/api/cases", "/api/cases/SP-0100", "/api/reports/SP-0100", "/api/settings", "/openapi.json"]:
        response = client.get(path)
        assert response.status_code == 200, (path,response.text)


def test_pagination_search_and_unknown_records(client):
    assert client.get("/api/accounts?q=STATIC").json()["items"][0]["id"] == "A-002"
    first = client.get("/api/comments?limit=5").json()
    second = client.get("/api/comments?limit=5&offset=5").json()
    assert first["total"] == 28
    assert not {r["id"] for r in first["items"]}.intersection(r["id"] for r in second["items"])
    assert client.get("/api/comments?q=%27%3B%20DROP%20TABLE%20comments--").json()["total"] == 0
    assert client.get("/api/comments?limit=0").status_code == 422
    assert client.get("/api/accounts/missing").status_code == 404
    assert client.get("/api/comments/missing").status_code == 404
    assert client.get("/api/reports/missing").status_code == 404


def test_network_and_exact_evidence(client):
    graph = client.get("/api/network?kind=Coordinated%20posting").json()
    assert len(graph["edges"]) == 3
    assert all(set(e["evidence"]) == {"C-410","C-411","C-412"} for e in graph["edges"])
    device = client.get("/api/network?kind=Device%20usage&account=A-007").json()
    assert {"A-007","A-008"} <= {a["id"] for a in device["accounts"]}
    assert all(a["score"] == 0 for a in device["accounts"])
    assert client.get("/api/evidence/C-352").json()["source"]["text"].startswith("[Fictional")


def test_full_persistence_workflow(client, db):
    baseline = client.get("/api/workspace").json()
    comment = client.get("/api/comments?q=C-352").json()["items"][0]
    assert comment["annotations"][0]["provenanceId"] == "demo-v1"
    assert client.get("/api/accounts/"+comment["accountId"]).json()["findings"]
    created = client.post("/api/cases", json=CASE)
    assert created.status_code == 201, created.text
    id = created.json()["id"]
    assert client.post(f"/api/cases/{id}/notes", json={"text": "Investigate context before any action."}).status_code == 201
    assert client.post("/api/comments/C-352/review", json={"reviewed":True,"reason":"Reviewed the supplied label."}).status_code == 200
    # A separate client/connection reads committed persistence, not provider memory.
    engine, config = db
    with TestClient(create_app(engine, config)) as fresh:
        assert fresh.get("/api/comments/C-352").json()["reviewed"] is True
        saved = fresh.get(f"/api/cases/{id}").json()
        assert saved["notes"][0]["text"] == "Investigate context before any action."
        assert saved["commentIds"] == ["C-352"]
        report = fresh.get(f"/api/reports/{id}").json()
        assert report["comments"][0]["id"] == "C-352"
        assert any(f["rule"] == "THREAT-01" for f in report["findings"])
        exported = fresh.get(f"/api/reports/{id}?format=csv")
        assert exported.status_code == 200 and "C-352" in exported.text
        assert "Investigate context" in fresh.get(f"/api/reports/{id}?format=html").text
    assert client.patch(f"/api/cases/{id}/status", json={"status":"Closed","decision":""}).status_code == 422
    assert client.patch(f"/api/cases/{id}/status", json={"status":"Closed","decision":"Supplied label requires human context review."}).status_code == 200
    assert client.get(f"/api/cases/{id}").json()["status"] == "Closed"
    after = client.get("/api/workspace").json()
    assert [(c["id"],c["text"],c["at"],c["annotations"]) for c in baseline["comments"]] == [(c["id"],c["text"],c["at"],c["annotations"]) for c in after["comments"]]
    assert len(after["findings"]) == 11
    with engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM dbo.audit_history WHERE investigation_id=:id"), {"id":id}).scalar_one() == 3


def test_case_update_and_rollback(client, db):
    id = client.post("/api/cases", json=CASE).json()["id"]
    before = client.get(f"/api/cases/{id}").json()
    invalid = client.put(f"/api/cases/{id}", json={**CASE,"title":"Should roll back","commentIds":["missing"]})
    assert invalid.status_code == 422
    assert client.get(f"/api/cases/{id}").json() == before
    changed = client.put(f"/api/cases/{id}", json={**CASE,"commentIds":["C-352","C-410"]})
    assert changed.status_code == 200 and len(changed.json()["commentIds"]) == 2
    # Attempt to forge protected state on the metadata endpoint must be rejected.
    assert client.put(f"/api/cases/{id}", json={**CASE,"status":"Closed"}).status_code == 422


def test_late_audit_failure_rolls_back(db):
    engine, config = db
    wrong = config.model_copy(update={"reviewer":"missing"})
    with TestClient(create_app(engine, wrong), headers={"X-Shadowprint-Client":"local-workspace"}) as client:
        before = client.get("/api/cases").json()["total"]
        assert client.post("/api/cases", json=CASE).status_code == 409
        assert client.get("/api/cases").json()["total"] == before
        assert client.patch("/api/cases/SP-0098/status", json={"status":"Closed","decision":"test"}).status_code == 409
        assert client.get("/api/cases/SP-0098").json()["status"] == "Open"


def test_detection_execution_preserves_per_run_counts(client, db):
    response = client.post("/api/detection/runs")
    assert response.status_code == 201
    findings = client.get("/api/findings").json()
    assert len(findings) == 11
    assert all(f["runId"] == response.json()["id"] for f in findings)
    with db[0].connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM dbo.comments")).scalar_one() == 28
        assert conn.execute(text("SELECT COUNT(*) FROM dbo.findings WHERE run_id='test-baseline'")).scalar_one() == 11
