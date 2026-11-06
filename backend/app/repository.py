import json
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import bindparam, text
from sqlalchemy.engine import Connection, Engine

from .errors import DomainError
from .schemas import CaseFilter, CaseUpdate, CaseWrite, CommentFilter, Page, ReviewWrite, utc_naive

LIMITATION = (
    "Signals support contextual human review; they do not prove intent or common identity. "
    "Shared devices do not contribute to scores. Labels retain their source and method."
)


def rows(conn: Connection, sql: str, params: dict | None = None) -> list[dict]:
    return [dict(row) for row in conn.execute(text(sql), params or {}).mappings()]


def required(conn: Connection, sql: str, params: dict) -> dict:
    result = rows(conn, sql, params)
    if not result:
        raise DomainError(404, "Record not found")
    return result[0]


def paged(conn: Connection, select: str, source: str, order: str, params: dict, page: Page) -> dict:
    total = conn.scalar(text("SELECT COUNT(*) " + source), params)
    items = rows(
        conn,
        select
        + " "
        + source
        + " ORDER BY "
        + order
        + " OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY",
        {**params, "limit": page.limit, "offset": page.offset},
    )
    return {"items": items, "total": total, "limit": page.limit, "offset": page.offset}


def literal_like(value: str) -> str:
    return (
        "%"
        + value.replace("!", "!!").replace("%", "!%").replace("_", "!_").replace("[", "![")
        + "%"
    )


def comment_where(filters: CommentFilter) -> tuple[str, dict]:
    conditions, params = ["1=1"], {}
    if filters.q:
        conditions.append(
            "(c.body LIKE :q ESCAPE '!' OR c.id LIKE :q ESCAPE '!' OR a.handle LIKE :q ESCAPE '!')"
        )
        params["q"] = literal_like(filters.q)
    for key, column in (
        ("account_id", "author_id"),
        ("target_id", "target_id"),
        ("provenance_id", "provenance_id"),
    ):
        if value := getattr(filters, key):
            conditions.append(f"c.{column}=:{key}")
            params[key] = value
    label_conditions = ["l.comment_id=c.id"]
    for key, column in (("category", "label_code"), ("label_method", "label_method")):
        if value := getattr(filters, key):
            label_conditions.append(f"l.{column}=:{key}")
            params[key] = value
    if len(label_conditions) > 1:
        conditions.append(
            "EXISTS (SELECT 1 FROM comment_labels l WHERE " + " AND ".join(label_conditions) + ")"
        )
    if filters.reviewed is not None:
        conditions.append("COALESCE(r.reviewed,0)=:reviewed")
        params["reviewed"] = filters.reviewed
    for key, operator in (("since", ">="), ("until", "<=")):
        if value := getattr(filters, key):
            conditions.append(f"c.created_at {operator} :{key}")
            params[key] = utc_naive(value)
    return " AND ".join(conditions), params


class Repository:
    def __init__(self, engine: Engine, actor: str):
        self.engine = engine
        self.actor = actor

    def accounts(self, page: Page, q: str, provenance_id: str | None):
        source = "FROM accounts a JOIN v_account_scores s ON s.id=a.id WHERE (a.id LIKE :q ESCAPE '!' OR a.handle LIKE :q ESCAPE '!')"
        params = {"q": literal_like(q)}
        if provenance_id:
            source += " AND a.provenance_id=:provenance_id"
            params["provenance_id"] = provenance_id
        with self.engine.connect() as conn:
            return paged(conn, "SELECT a.*,s.demo_score", source, "a.id", params, page)

    def account(self, account_id: str):
        with self.engine.connect() as conn:
            return required(
                conn,
                "SELECT a.*,s.demo_score FROM accounts a JOIN v_account_scores s ON s.id=a.id WHERE a.id=:id",
                {"id": account_id},
            )

    def logins(self, account_id: str, page: Page):
        with self.engine.connect() as conn:
            required(conn, "SELECT id FROM accounts WHERE id=:id", {"id": account_id})
            return paged(
                conn,
                "SELECT l.*,d.display_name,d.context",
                "FROM login_events l JOIN devices d ON d.id=l.device_id WHERE l.account_id=:id",
                "l.occurred_at DESC,l.id",
                {"id": account_id},
                page,
            )

    def account_findings(self, account_id: str, page: Page):
        with self.engine.connect() as conn:
            required(conn, "SELECT id FROM accounts WHERE id=:id", {"id": account_id})
            return paged(
                conn,
                "SELECT f.*,r.executed_at",
                "FROM findings f JOIN detection_runs r ON r.id=f.run_id WHERE f.account_id=:id",
                "r.executed_at DESC,f.id",
                {"id": account_id},
                page,
            )

    def related_accounts(self, account_id: str, page: Page):
        with self.engine.connect() as conn:
            required(conn, "SELECT id FROM accounts WHERE id=:id", {"id": account_id})
            return paged(
                conn,
                "SELECT a.*",
                "FROM accounts a WHERE a.id<>:id AND EXISTS (SELECT 1 FROM login_events own JOIN login_events other ON own.device_id=other.device_id WHERE own.account_id=:id AND other.account_id=a.id)",
                "a.id",
                {"id": account_id},
                page,
            )

    @staticmethod
    def attach_labels(conn: Connection, comments: list[dict]):
        if not comments:
            return
        query = text(
            "SELECT * FROM comment_labels WHERE comment_id IN :ids ORDER BY comment_id,label_code,provenance_id"
        ).bindparams(bindparam("ids", expanding=True))
        grouped = {c["id"]: [] for c in comments}
        for label in conn.execute(query, {"ids": list(grouped)}).mappings():
            grouped[label["comment_id"]].append(dict(label))
        for comment in comments:
            comment["labels"] = grouped[comment["id"]]
            comment["reviewed"] = bool(comment.get("reviewed", False))

    def comments(self, filters: CommentFilter):
        where, params = comment_where(filters)
        with self.engine.connect() as conn:
            result = paged(
                conn,
                "SELECT c.*,a.handle AS author_handle,COALESCE(r.reviewed,0) AS reviewed",
                "FROM comments c JOIN accounts a ON a.id=c.author_id LEFT JOIN v_latest_reviews r ON r.comment_id=c.id WHERE "
                + where,
                "c.created_at DESC,c.id",
                params,
                filters,
            )
            self.attach_labels(conn, result["items"])
            return result

    def comment(self, comment_id: str):
        with self.engine.connect() as conn:
            item = required(
                conn,
                "SELECT c.*,COALESCE(r.reviewed,0) AS reviewed FROM comments c LEFT JOIN v_latest_reviews r ON r.comment_id=c.id WHERE c.id=:id",
                {"id": comment_id},
            )
            self.attach_labels(conn, [item])
            item["evidence"] = rows(
                conn, "SELECT * FROM evidence WHERE comment_id=:id", {"id": comment_id}
            )
            item["latest_review"] = next(
                iter(
                    rows(
                        conn,
                        "SELECT * FROM v_latest_reviews WHERE comment_id=:id",
                        {"id": comment_id},
                    )
                ),
                None,
            )
            return item

    def overview(self, filters: CommentFilter):
        where, params = comment_where(filters)
        source = (
            "FROM comments c JOIN accounts a ON a.id=c.author_id LEFT JOIN v_latest_reviews r ON r.comment_id=c.id LEFT JOIN (SELECT DISTINCT comment_id FROM comment_labels) labeled ON labeled.comment_id=c.id WHERE "
            + where
        )
        flagged = "CASE WHEN labeled.comment_id IS NOT NULL THEN 1 ELSE 0 END"
        with self.engine.connect() as conn:
            counts = rows(
                conn,
                "SELECT COUNT(*) AS comments,COALESCE(SUM("
                + flagged
                + "),0) AS labeled_comments,COALESCE(SUM(CAST(COALESCE(r.reviewed,0) AS int)),0) AS reviewed_comments "
                + source,
                params,
            )[0]
            counts["open_cases"] = conn.scalar(
                text(
                    "SELECT COUNT(*) FROM investigations WHERE status NOT IN ('Resolved','Closed')"
                )
            )
            timeline = rows(
                conn,
                "SELECT CAST(c.created_at AS date) AS day,COUNT(*) AS comments,COALESCE(SUM("
                + flagged
                + "),0) AS labeled_comments "
                + source
                + " GROUP BY CAST(c.created_at AS date) ORDER BY day",
                params,
            )
            return {
                "counts": counts,
                "timeline": timeline,
                "limitation": LIMITATION,
                "scope": "Comment filters apply to counts and timeline; open cases span all dates. Labeled comments are not confirmed abuse.",
            }

    def cases(self, filters: CaseFilter):
        source = "FROM investigations WHERE (id LIKE :q ESCAPE '!' OR title LIKE :q ESCAPE '!')"
        params = {"q": literal_like(filters.q)}
        if filters.status:
            source += " AND status=:status"
            params["status"] = filters.status
        with self.engine.connect() as conn:
            return paged(conn, "SELECT *", source, "updated_at DESC,id", params, filters)

    def catalog(self, kind: str, page: Page):
        # SQL identifiers come exclusively from this internal allowlist.
        table, order = {
            "provenance": ("provenance", "id"),
            "rules": ("detection_rules", "code,version"),
            "runs": ("detection_runs", "executed_at DESC,id"),
            "cases": ("investigations", "updated_at DESC,id"),
            "audit": ("audit_history", "occurred_at DESC,id DESC"),
            "coordination": ("v_coordination_windows", "anchor_id"),
        }[kind]
        with self.engine.connect() as conn:
            result = paged(conn, "SELECT *", f"FROM {table}", order, {}, page)
            if kind == "audit":
                for item in result["items"]:
                    for field in ("old_value", "new_value"):
                        if isinstance(item[field], str):
                            item[field] = json.loads(item[field])
            return result

    def coordination_evidence(self, anchor_id: str, page: Page):
        with self.engine.connect() as conn:
            required(
                conn,
                "SELECT anchor_id FROM v_coordination_windows WHERE anchor_id=:id",
                {"id": anchor_id},
            )
            return paged(
                conn,
                "SELECT c.*",
                "FROM comments c WHERE c.id IN (SELECT comment_id FROM v_detection_evidence WHERE rule_code='COORD-01' AND anchor_id=:id)",
                "c.created_at,c.id",
                {"id": anchor_id},
                page,
            )

    def network(self, page: Page):
        with self.engine.connect() as conn:
            return paged(
                conn,
                "SELECT l.id,l.account_id,l.device_id,l.occurred_at,l.provenance_id,d.context,d.display_name,e.id AS evidence_id",
                "FROM login_events l JOIN devices d ON d.id=l.device_id LEFT JOIN evidence e ON e.login_id=l.id",
                "l.id",
                {},
                page,
            )

    def evidence(self, evidence_id: str):
        with self.engine.connect() as conn:
            item = required(conn, "SELECT * FROM evidence WHERE id=:id", {"id": evidence_id})
            for field, table in (
                ("comment_id", "comments"),
                ("login_id", "login_events"),
                ("interaction_id", "interactions"),
            ):
                if item[field]:
                    item["record_type"] = table
                    item["record"] = required(
                        conn, f"SELECT * FROM {table} WHERE id=:id", {"id": item[field]}
                    )
                    if field == "comment_id":
                        self.attach_labels(conn, [item["record"]])
            return item

    def findings(self, run_id: str, page: Page):
        with self.engine.connect() as conn:
            required(conn, "SELECT id FROM detection_runs WHERE id=:id", {"id": run_id})
            return paged(
                conn, "SELECT *", "FROM findings WHERE run_id=:id", "id", {"id": run_id}, page
            )

    def finding(self, finding_id: str, page: Page):
        with self.engine.connect() as conn:
            item = required(conn, "SELECT * FROM findings WHERE id=:id", {"id": finding_id})
            item["evidence"] = paged(
                conn,
                "SELECT e.*",
                "FROM finding_evidence f JOIN evidence e ON e.id=f.evidence_id WHERE f.finding_id=:id",
                "e.id",
                {"id": finding_id},
                page,
            )
            return item

    def run_detection(self, run_id: str):
        # The SQL procedure owns its transaction. Never nest it in engine.begin().
        with self.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("EXEC dbo.run_detection :id"), {"id": run_id}).close()
            return required(conn, "SELECT * FROM detection_runs WHERE id=:id", {"id": run_id})

    @staticmethod
    def case_record(conn: Connection, case_id: str, lock: bool = False):
        item = required(
            conn,
            "SELECT * FROM investigations"
            + (" WITH (UPDLOCK,HOLDLOCK)" if lock else "")
            + " WHERE id=:id",
            {"id": case_id},
        )
        for field, table, column in (
            ("account_ids", "investigation_accounts", "account_id"),
            ("evidence_ids", "investigation_evidence", "evidence_id"),
            ("finding_ids", "investigation_findings", "finding_id"),
        ):
            item[field] = [
                r[column]
                for r in rows(
                    conn,
                    f"SELECT {column} FROM {table} WHERE investigation_id=:id ORDER BY {column}",
                    {"id": case_id},
                )
            ]
        return item

    def case(self, case_id: str):
        with self.engine.connect() as conn:
            return self.case_record(conn, case_id)

    def notes(self, case_id: str, page: Page):
        with self.engine.connect() as conn:
            required(conn, "SELECT id FROM investigations WHERE id=:id", {"id": case_id})
            return paged(
                conn,
                "SELECT *",
                "FROM case_notes WHERE investigation_id=:id",
                "created_at,id",
                {"id": case_id},
                page,
            )

    @staticmethod
    def validate_links(conn: Connection, data: CaseWrite):
        for field, table in (
            ("account_ids", "accounts"),
            ("evidence_ids", "evidence"),
            ("finding_ids", "findings"),
        ):
            ids = getattr(data, field)
            if ids:
                query = text(f"SELECT COUNT(*) FROM {table} WHERE id IN :ids").bindparams(
                    bindparam("ids", expanding=True)
                )
                if conn.scalar(query, {"ids": ids}) != len(ids):
                    raise DomainError(422, f"Unknown reference in {field}")

    def audit(
        self,
        conn: Connection,
        case_id: str | None,
        review_id: int | None,
        action: str,
        old: dict | None,
        new: dict,
    ):
        from .schemas import wire

        conn.execute(
            text(
                "INSERT INTO audit_history(investigator_id,investigation_id,review_action_id,action,old_value,new_value,occurred_at) "
                "VALUES(:actor,:case_id,:review_id,:action,:old,:new,CAST(SYSUTCDATETIME() AS datetime2(3)))"
            ),
            {
                "actor": self.actor,
                "case_id": case_id,
                "review_id": review_id,
                "action": action,
                "old": json.dumps(wire(old)) if old is not None else None,
                "new": json.dumps(wire(new)),
            },
        )

    @staticmethod
    def write_links(conn: Connection, case_id: str, data: CaseWrite):
        for field, table, column in (
            ("account_ids", "investigation_accounts", "account_id"),
            ("evidence_ids", "investigation_evidence", "evidence_id"),
            ("finding_ids", "investigation_findings", "finding_id"),
        ):
            conn.execute(text(f"DELETE FROM {table} WHERE investigation_id=:id"), {"id": case_id})
            values = [{"case_id": case_id, "reference": ref} for ref in getattr(data, field)]
            if values:
                conn.execute(
                    text(
                        f"INSERT INTO {table}(investigation_id,{column}) VALUES(:case_id,:reference)"
                    ),
                    values,
                )

    def create_case(self, data: CaseWrite):
        case_id = "SP-" + uuid4().hex
        with self.engine.begin() as conn:
            self.validate_links(conn, data)
            params = {**data.model_dump(), "id": case_id}
            conn.execute(
                text(
                    "INSERT INTO investigations(id,title,description,status,decision,updated_at) VALUES(:id,:title,:description,:status,:decision,CAST(SYSUTCDATETIME() AS datetime2(3)))"
                ),
                params,
            )
            self.write_links(conn, case_id, data)
            result = self.case_record(conn, case_id)
            self.audit(conn, case_id, None, "case_created", None, result)
            return result

    def update_case(self, case_id: str, data: CaseUpdate):
        with self.engine.begin() as conn:
            old = self.case_record(conn, case_id, lock=True)
            if old["updated_at"] != utc_naive(data.expected_updated_at):
                raise DomainError(409, "Case changed; reload it before saving")
            self.validate_links(conn, data)
            conn.execute(
                text(
                    "UPDATE investigations SET title=:title,description=:description,status=:status,decision=:decision,"
                    "updated_at=GREATEST(CAST(SYSUTCDATETIME() AS datetime2(3)),CAST(:next_time AS datetime2(3))) WHERE id=:id"
                ),
                {
                    **data.model_dump(),
                    "id": case_id,
                    "next_time": old["updated_at"] + timedelta(milliseconds=1),
                },
            )
            self.write_links(conn, case_id, data)
            result = self.case_record(conn, case_id)
            self.audit(conn, case_id, None, "case_updated", old, result)
            return result

    def add_note(self, case_id: str, body: str):
        with self.engine.begin() as conn:
            old = required(
                conn,
                "SELECT updated_at FROM investigations WITH (UPDLOCK,HOLDLOCK) WHERE id=:id",
                {"id": case_id},
            )
            note_id = "N-" + uuid4().hex
            conn.execute(
                text(
                    "INSERT INTO case_notes(id,investigation_id,investigator_id,body,created_at) VALUES(:id,:case_id,:actor,:body,CAST(SYSUTCDATETIME() AS datetime2(3)))"
                ),
                {"id": note_id, "case_id": case_id, "actor": self.actor, "body": body},
            )
            conn.execute(
                text(
                    "UPDATE investigations SET updated_at=GREATEST(CAST(SYSUTCDATETIME() AS datetime2(3)),CAST(:next_time AS datetime2(3))) WHERE id=:id"
                ),
                {"id": case_id, "next_time": old["updated_at"] + timedelta(milliseconds=1)},
            )
            result = required(conn, "SELECT * FROM case_notes WHERE id=:id", {"id": note_id})
            self.audit(conn, case_id, None, "note_added", None, result)
            return result

    def review(self, comment_id: str, data: ReviewWrite):
        with self.engine.begin() as conn:
            # Serialize concurrent reviews so the latest-state view is deterministic.
            required(
                conn,
                "SELECT id FROM comments WITH (UPDLOCK,HOLDLOCK) WHERE id=:id",
                {"id": comment_id},
            )
            result = conn.execute(
                text(
                    "INSERT INTO review_actions(comment_id,investigator_id,reviewed,reason,occurred_at) OUTPUT INSERTED.id VALUES(:id,:actor,:reviewed,:reason,CAST(SYSUTCDATETIME() AS datetime2(3)))"
                ),
                {"id": comment_id, "actor": self.actor, **data.model_dump()},
            )
            review_id = result.scalar_one()
            self.audit(conn, None, review_id, "comment_review", None, data.model_dump())
            return required(conn, "SELECT * FROM review_actions WHERE id=:id", {"id": review_id})

    def report(self, case_id: str, page: Page):
        with self.engine.connect() as conn:
            case = self.case_record(conn, case_id)
            evidence = paged(
                conn,
                "SELECT e.*,c.body,COALESCE(c.created_at,l.occurred_at,x.occurred_at) AS occurred_at,COALESCE(c.author_id,l.account_id,x.actor_id) AS account_id,c.target_id,COALESCE(c.provenance_id,l.provenance_id,x.provenance_id) AS provenance_id,l.device_id,x.kind AS interaction_kind",
                "FROM investigation_evidence i JOIN evidence e ON e.id=i.evidence_id LEFT JOIN comments c ON c.id=e.comment_id LEFT JOIN login_events l ON l.id=e.login_id LEFT JOIN interactions x ON x.id=e.interaction_id WHERE i.investigation_id=:id",
                "occurred_at,e.id",
                {"id": case_id},
                page,
            )
            return {
                "case": case,
                "evidence": evidence,
                "limitation": LIMITATION,
                "notes_url": f"/api/v1/cases/{case_id}/notes",
                "scope": "Explicit case associations only; paginate evidence and notes separately",
            }
