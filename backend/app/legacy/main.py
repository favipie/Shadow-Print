from contextlib import asynccontextmanager
from uuid import uuid4
from typing import Annotated, Literal
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response, JSONResponse, HTMLResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from .config import settings, Settings
from .db import engine, connectivity
from .repository import Repository
from .services import snapshot
from .schemas import Workspace, Profile, Comment, Case, Finding, Page, Health, CaseCreate, CaseInput, StatusInput, NoteInput, ReviewInput
from .reports import csv_report, html_report

Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
Search = Annotated[str, Query(max_length=200)]


def create_app(db=engine, config: Settings = settings, hosted_host=None):
    @asynccontextmanager
    async def lifespan(_):
        yield
        db.dispose()

    app = FastAPI(title="SHADOWPRINT local investigation API", version="1.0.0", lifespan=lifespan,
                  description="Synthetic academic workspace. Fixed local reviewer; no production authentication. No startup migrations.")
    repo = Repository(db, config, require_actor=bool(hosted_host))
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[hosted_host] if hosted_host else ["127.0.0.1", "localhost", "testserver"])
    app.add_middleware(CORSMiddleware, allow_origins=config.origins, allow_methods=["GET", "POST", "PUT", "PATCH"], allow_headers=["Content-Type", "X-Shadowprint-Client"])

    @app.middleware("http")
    async def local_write_guard(request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            if request.headers.get("X-Shadowprint-Client") != "local-workspace":
                return JSONResponse({"detail": "Local workspace header required."}, status_code=403)
            origin = request.headers.get("origin")
            if origin and origin not in config.origins:
                return JSONResponse({"detail": "Origin not allowed."}, status_code=403)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(IntegrityError)
    async def integrity_error(_, exc):
        return JSONResponse({"detail": "Database rejected the change. Check record references and case decisions."}, status_code=409)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_, exc):
        return JSONResponse({"detail": "Database operation failed. Check the local SQL Server service and configuration."}, status_code=503)

    def data():
        return snapshot(repo)

    def find(records, id):
        found = next((r for r in records if r["id"] == id), None)
        if found is None:
            raise HTTPException(404, "Record not found.")
        return found

    def page(items, offset, limit):
        return {"items": items[offset:offset+limit], "total": len(items), "offset": offset, "limit": limit}

    @app.get("/api/health", response_model=Health)
    def health():
        info = connectivity(db)
        return {"status": "connected", "database": info["database_name"], "server": info["server_name"], "version": info["version"], "tables": len(info["tables"])}

    @app.get("/api/workspace", response_model=Workspace)
    def workspace():
        return data()

    @app.get("/api/dashboard")
    def dashboard():
        d = data()
        return {**d["dashboard"], "activity": d["activity"], "events": d["events"]}

    @app.get("/api/accounts", response_model=Page[Profile])
    def accounts(q: Search = "", offset: Offset = 0, limit: Limit = 25):
        return page([r for r in data()["profiles"] if q.casefold() in (r["id"]+" "+r["handle"]).casefold()], offset, limit)

    @app.get("/api/accounts/{id}")
    def account(id: str):
        d = data()
        profile = find(d["profiles"], id)
        edges = [e for e in d["connections"] if id in (e["source"],e["target"])]
        devices = set(profile["devices"])
        related = [p for p in d["profiles"] if p["id"] != id and (devices.intersection(p["devices"]) or any(p["id"] in (e["source"],e["target"]) for e in edges))]
        return {**profile, "comments": [c for c in d["comments"] if c["accountId"] == id],
                "findings": [f for f in d["findings"] if f["accountId"] == id], "connections": edges, "relatedAccounts": related}

    @app.get("/api/comments", response_model=Page[Comment])
    def comments(q: Search = "", account: str = "", category: str = "", reviewed: bool | None = None, offset: Offset = 0, limit: Limit = 25):
        d = data()
        handles = {p["id"]: p["handle"] for p in d["profiles"]}
        rows = [c for c in d["comments"] if (not account or c["accountId"] == account)
            and (not category or any(a["category"] == category for a in c["annotations"]) or c["category"] == category)
            and (reviewed is None or c["reviewed"] == reviewed)
            and q.casefold() in (c["id"]+" "+c["text"]+" "+handles[c["accountId"]]).casefold()]
        return page(rows, offset, limit)

    @app.get("/api/comments/{id}", response_model=Comment)
    def comment(id: str):
        return find(data()["comments"], id)

    @app.post("/api/comments/{id}/review")
    def review(id: str, body: ReviewInput):
        repo.require("comments", id)
        repo.procedure("review", {"id": id, "reviewed": int(body.reviewed), "reason": body.reason})
        return {"id": id, "reviewed": body.reviewed}

    @app.get("/api/network")
    def network(kind: Literal["All","Device usage","Coordinated posting"] = "All", account: str = ""):
        d = data()
        edges = [e for e in d["connections"] if kind == "All" or e["kind"] == kind]
        if account:
            find(d["profiles"], account)
            neighbors = {account}
            for edge in edges:
                if account in (edge["source"], edge["target"]):
                    neighbors.update((edge["source"], edge["target"]))
            edges = [e for e in edges if e["source"] in neighbors or e["target"] in neighbors]
            nodes = {n for e in edges for n in (e["source"],e["target"])} | {account}
        else:
            nodes = {p["id"] for p in d["profiles"]} | {v["id"] for v in d["devices"]}
        return {"accounts": [p for p in d["profiles"] if p["id"] in nodes], "devices": [v for v in d["devices"] if v["id"] in nodes], "edges": edges, "logins": d["logins"]}

    @app.get("/api/coordination")
    def coordination():
        d = data()
        return {"clusters": d["clusters"], "findings": [f for f in d["findings"] if f["rule"] == "COORD-01"]}

    @app.get("/api/evidence/{id}")
    def evidence(id: str):
        d = data()
        source_id = id[2:] if id.startswith("E-") else id
        record = next((r for r in d["comments"] + d["logins"] if r["id"] == source_id), None)
        if record is None:
            raise HTTPException(404, "Evidence not found.")
        return {"source": record, "findings": [f for f in d["findings"] if source_id in f["commentIds"]]}

    @app.get("/api/findings", response_model=list[Finding])
    def findings():
        return data()["findings"]

    @app.post("/api/detection/runs", status_code=201)
    def detection():
        id = "api-" + uuid4().hex
        repo.procedure("detection", {"id": id})
        return {"id": id}

    @app.get("/api/cases", response_model=Page[Case])
    def cases(q: Search = "", offset: Offset = 0, limit: Limit = 25):
        return page([c for c in data()["state"]["cases"] if q.casefold() in (c["title"]+" "+c["id"]).casefold()], offset, limit)

    @app.get("/api/cases/{id}", response_model=Case)
    def case(id: str):
        return find(data()["state"]["cases"], id)

    @app.post("/api/cases", response_model=Case, status_code=201)
    def create_case(body: CaseCreate):
        id = repo.save_case(body)
        return case(id)

    @app.put("/api/cases/{id}", response_model=Case)
    def update_case(id: str, body: CaseInput):
        repo.save_case(body, id)
        return case(id)

    @app.patch("/api/cases/{id}/status", response_model=Case)
    def status(id: str, body: StatusInput):
        repo.require("investigations", id)
        repo.procedure("status", {"id": id, **body.model_dump()})
        return case(id)

    @app.post("/api/cases/{id}/notes", status_code=201)
    def note(id: str, body: NoteInput):
        return {"id": repo.add_note(id, body.text)}

    @app.get("/api/reports/{id}")
    def report(id: str, format: Literal["json","csv","html"] = "json"):
        d = data()
        record = find(d["state"]["cases"], id)
        comments = [c for c in d["comments"] if c["id"] in record["commentIds"]]
        accounts = set(record["accountIds"]) | {c["accountId"] for c in comments}
        findings = [f for f in d["findings"] if f["accountId"] in accounts]
        if format == "csv":
            # The filename is server generated; user-supplied IDs never become response headers.
            return Response(csv_report(record, comments), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="shadowprint-report.csv"'})
        if format == "html":
            return HTMLResponse(html_report(record, comments, findings), headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"})
        return {"case": record, "comments": comments, "findings": findings, "settings": d["settings"]}

    @app.get("/api/settings")
    def settings_info():
        return {**data()["settings"], "health": health()}

    return app
