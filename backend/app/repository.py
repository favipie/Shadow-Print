"""Parameterized queries against the authoritative existing schema, with no ORM DDL."""
import json
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.engine import Engine
from fastapi import HTTPException
from .config import Settings


def rows(conn, sql: str, params=None):
    return [dict(r) for r in conn.execute(text(sql), params or {}).mappings()]


class Repository:
    def __init__(self, engine: Engine, config: Settings):
        self.engine, self.config = engine, config

    def read(self):
        with self.engine.connect().execution_options(isolation_level="SERIALIZABLE") as conn:
            with conn.begin():
                # Bound the snapshot explicitly; never silently truncate the investigation dataset.
                for table in ("accounts", "comments", "investigations", "login_events"):
                    count = conn.execute(text(f"SELECT COUNT_BIG(*) FROM dbo.{table}")).scalar_one()
                    if count > self.config.snapshot_limit:
                        raise HTTPException(413, "Dataset exceeds this academic workspace's snapshot limit.")
                queries = {
                    "profiles": "SELECT a.*,s.demo_score AS score,p.kind AS provenance_kind FROM dbo.accounts a JOIN dbo.provenance p ON p.id=a.provenance_id JOIN dbo.v_account_scores s ON s.id=a.id ORDER BY a.id",
                    "comments": "SELECT c.*,p.kind AS provenance_kind FROM dbo.comments c JOIN dbo.provenance p ON p.id=c.provenance_id ORDER BY c.created_at DESC,c.id",
                    "labels": "SELECT * FROM dbo.comment_labels ORDER BY comment_id,label_code,provenance_id",
                    "devices": "SELECT * FROM dbo.devices ORDER BY id",
                    "logins": "SELECT * FROM dbo.login_events ORDER BY occurred_at,id",
                    "cases": "SELECT * FROM dbo.investigations ORDER BY updated_at DESC,id",
                    "case_accounts": "SELECT * FROM dbo.investigation_accounts ORDER BY account_id",
                    "case_comments": "SELECT ie.investigation_id,e.comment_id FROM dbo.investigation_evidence ie JOIN dbo.evidence e ON e.id=ie.evidence_id WHERE e.comment_id IS NOT NULL ORDER BY e.comment_id",
                    "notes": "SELECT * FROM dbo.case_notes ORDER BY created_at,id",
                    "reviews": "SELECT * FROM dbo.v_latest_reviews",
                    "audit": "SELECT TOP(200) * FROM dbo.audit_history ORDER BY occurred_at DESC,id DESC",
                    "rules": "SELECT * FROM dbo.detection_rules ORDER BY code,version",
                    "provenance": "SELECT * FROM dbo.provenance ORDER BY id",
                    "findings": """SELECT f.*,r.weight FROM dbo.findings f JOIN dbo.detection_rules r ON r.code=f.rule_code AND r.version=f.rule_version
                        WHERE f.run_id=(SELECT TOP(1) id FROM dbo.detection_runs ORDER BY executed_at DESC,id DESC) ORDER BY f.account_id,f.rule_code,f.anchor_comment_id""",
                    "finding_evidence": """SELECT fe.finding_id,e.comment_id FROM dbo.finding_evidence fe JOIN dbo.evidence e ON e.id=fe.evidence_id JOIN dbo.findings f ON f.id=fe.finding_id
                        WHERE f.run_id=(SELECT TOP(1) id FROM dbo.detection_runs ORDER BY executed_at DESC,id DESC) ORDER BY e.comment_id""",
                    "coordination": "SELECT DISTINCT anchor_id,comment_id FROM dbo.v_detection_evidence WHERE rule_code='COORD-01' ORDER BY anchor_id,comment_id",
                    "current_evidence": "SELECT DISTINCT comment_id FROM dbo.v_detection_evidence",
                }
                return {name: rows(conn, sql) for name, sql in queries.items()}

    def require(self, table: str, record_id: str):
        if table not in ("comments", "investigations", "accounts"):
            raise ValueError("Unsupported entity")
        with self.engine.connect() as conn:
            if not conn.execute(text(f"SELECT 1 FROM dbo.{table} WHERE id=:id"), {"id": record_id}).first():
                raise HTTPException(404, "Record not found.")

    def procedure(self, name: str, params: dict):
        calls = {
            "review": "EXEC dbo.review_comment @p_comment=:id,@p_actor=:actor,@p_reviewed=:reviewed,@p_reason=:reason",
            "status": "EXEC dbo.change_case_status @p_case=:id,@p_actor=:actor,@p_status=:status,@p_decision=:decision",
            "detection": "EXEC dbo.run_detection @p_run=:id",
        }
        # Existing procedures own their transactions and reject caller transactions.
        with self.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(calls[name]), {**params, "actor": self.config.reviewer})

    def _audit(self, conn, case_id, action, new, old=None):
        conn.execute(text("""INSERT INTO dbo.audit_history(investigator_id,investigation_id,action,old_value,new_value,occurred_at)
            VALUES(:actor,:id,:action,:old,:new,SYSUTCDATETIME())"""),
            {"actor": self.config.reviewer, "id": case_id, "action": action,
             "old": json.dumps(old) if old is not None else None, "new": json.dumps(new)})

    def _associations(self, conn, case_id, data):
        for account in data.accountIds:
            if not conn.execute(text("SELECT 1 FROM dbo.accounts WHERE id=:id"), {"id": account}).first():
                raise HTTPException(422, f"Unknown account: {account}")
        evidence = []
        for comment in data.commentIds:
            record = conn.execute(text("SELECT e.id FROM dbo.evidence e JOIN dbo.comments c ON c.id=e.comment_id WHERE c.id=:id"), {"id": comment}).scalar_one_or_none()
            if record is None:
                raise HTTPException(422, f"Unknown or unregistered evidence comment: {comment}")
            evidence.append(record)
        conn.execute(text("DELETE FROM dbo.investigation_accounts WHERE investigation_id=:id"), {"id": case_id})
        # Preserve any login/interaction associations when editing the comment register.
        conn.execute(text("""DELETE ie FROM dbo.investigation_evidence ie JOIN dbo.evidence e ON e.id=ie.evidence_id
            WHERE ie.investigation_id=:id AND e.comment_id IS NOT NULL"""), {"id": case_id})
        for account in data.accountIds:
            conn.execute(text("INSERT INTO dbo.investigation_accounts VALUES(:case,:account)"), {"case": case_id, "account": account})
        for item in evidence:
            conn.execute(text("INSERT INTO dbo.investigation_evidence VALUES(:case,:evidence)"), {"case": case_id, "evidence": item})

    def save_case(self, data, case_id=None):
        creating = case_id is None
        case_id = case_id or "SP-" + uuid4().hex
        with self.engine.begin() as conn:
            old = None
            if creating:
                conn.execute(text("""INSERT INTO dbo.investigations(id,title,description,status,decision,updated_at)
                    VALUES(:id,:title,:description,:status,:decision,SYSUTCDATETIME())"""), {"id": case_id, **data.model_dump()})
            else:
                found = rows(conn, "SELECT title,description FROM dbo.investigations WITH(UPDLOCK,HOLDLOCK) WHERE id=:id", {"id": case_id})
                if not found:
                    raise HTTPException(404, "Case not found.")
                old = found[0]
                old["accountIds"] = [r["account_id"] for r in rows(conn, "SELECT account_id FROM dbo.investigation_accounts WHERE investigation_id=:id", {"id": case_id})]
                old["commentIds"] = [r["comment_id"] for r in rows(conn, """SELECT e.comment_id FROM dbo.investigation_evidence ie JOIN dbo.evidence e ON e.id=ie.evidence_id WHERE ie.investigation_id=:id AND e.comment_id IS NOT NULL""", {"id": case_id})]
                conn.execute(text("UPDATE dbo.investigations SET title=:title,description=:description,updated_at=SYSUTCDATETIME() WHERE id=:id"), {"id": case_id, **data.model_dump()})
            self._associations(conn, case_id, data)
            self._audit(conn, case_id, "case_created" if creating else "case_details", data.model_dump(), old)
        return case_id

    def add_note(self, case_id, body):
        with self.engine.begin() as conn:
            if not conn.execute(text("SELECT id FROM dbo.investigations WITH(UPDLOCK,HOLDLOCK) WHERE id=:id"), {"id": case_id}).first():
                raise HTTPException(404, "Case not found.")
            note_id = "NOTE-" + uuid4().hex
            conn.execute(text("""INSERT INTO dbo.case_notes VALUES(:id,:case,:actor,:body,SYSUTCDATETIME())"""),
                         {"id": note_id, "case": case_id, "actor": self.config.reviewer, "body": body})
            conn.execute(text("UPDATE dbo.investigations SET updated_at=SYSUTCDATETIME() WHERE id=:id"), {"id": case_id})
            self._audit(conn, case_id, "case_note", {"id": note_id, "text": body})
        return note_id
