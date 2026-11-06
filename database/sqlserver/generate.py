"""Deterministic additive T-SQL workload for owned disposable demo databases only."""
import argparse
from datetime import datetime, timedelta
from pathlib import Path


def literal(value):
    return "N'" + str(value).replace("'", "''") + "'"


def generate(extra=100, seed=42):
    if type(extra) is not int or not 0 <= extra <= 100000:
        raise ValueError("extra must be an integer in 0..100000")
    if type(seed) is not int or not 0 <= seed <= 0xFFFFFFFF:
        raise ValueError("seed must be an integer in 0..4294967295")
    lines = [
        "-- Synthetic additive workload; apply after original demo seed in a disposable database.",
        "SET NOCOUNT ON; SET XACT_ABORT ON;",
        "IF LEN(DB_NAME())<>49 OR LEFT(DB_NAME(),17)<>N'shadowprint_test_'",
        " OR SUBSTRING(DB_NAME(),18,32) COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9a-f]%'",
        " THROW 51000,'Workload requires a disposable shadowprint_test_<32 hex> database',1;",
        "IF @@TRANCOUNT<>0 THROW 51000,'Call outside a transaction',1;",
        "BEGIN TRY BEGIN TRANSACTION;",
        "IF (SELECT COUNT(*) FROM dbo.accounts)<>9 OR (SELECT COUNT(*) FROM dbo.comments)<>28",
        " THROW 51000,'Expected original demo; workload cannot be applied twice',1;",
    ]

    def insert(table, columns, values):
        lines.append(f"INSERT INTO dbo.{table} ({columns}) VALUES ({','.join(map(literal, values))});")

    source = "tsql-workload-v1"
    insert("provenance", "id,kind,name,version,license_text,description", [
        source, "synthetic", "T-SQL deterministic workload", "1", "Project-authored synthetic records",
        f"LCG seed={seed}; {extra} unique harmless comments plus 18 scenario comments. No real people or public data.",
    ])
    count = max(12, (extra + 19) // 20 + 6)
    account = lambda i: f"SG-{i:06d}"
    for i in range(count):
        insert("accounts", "id,handle,created_at,bio,provenance_id,source_record_id", [
            account(i), f"tsql_synthetic_{i}", "2026-11-01T00:00:00.000",
            "Fictional generated account", source, account(i),
        ])
    base = datetime(2026, 11, 2)
    number = 0

    def comment(author, body, seconds, label=None):
        nonlocal number
        cid = f"SGC-{number:06d}"
        number += 1
        timestamp = (base + timedelta(seconds=seconds)).isoformat(timespec="milliseconds")
        insert("comments", "id,author_id,target_id,post_id,body,created_at,provenance_id,source_record_id",
               [cid, account(author), "U-021", "P-U-021", body, timestamp, source, cid])
        if label:
            insert("comment_labels", "comment_id,label_code,provenance_id,label_method",
                   [cid, label, source, "Authored label"])

    state = seed
    for i in range(extra):
        state = (state * 1664525 + 1013904223) & 0xFFFFFFFF
        author = 6 + state % (count - 6)
        comment(author, f"Harmless fictional comment {i}; sample {state}", i * 120)
    for i in range(8):
        comment(0, "Synthetic repeated promotion", i * 60, "Spam")
    for i in range(6):
        comment(1, f"Redacted fictional targeting example {i}", i * 3600, "Repeated harassment")
    comment(2, "[Redacted synthetic threat-label example]", 60, "Threat-related language")
    for i in range(3):
        comment(3 + i, "Synthetic coordinated example", i * 45, "Coordinated targeting")
    insert("devices", "id,display_name,context,provenance_id", [
        "SGD-1", "Synthetic shared library terminal", "Benign control: sharing is not identity evidence", source,
    ])
    for i in (6, 7):
        insert("login_events", "id,account_id,device_id,occurred_at,provenance_id",
               [f"SGL-{i}", account(i), "SGD-1", "2026-11-02T00:00:00.000", source])
    insert("interactions", "id,actor_id,post_id,kind,occurred_at,provenance_id",
           ["SGI-1", account(6), "P-U-021", "like", "2026-11-02T00:00:00.000", source])
    lines += ["COMMIT; END TRY BEGIN CATCH", "IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH;"]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extra", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sql = generate(args.extra, args.seed)
    # Refuse to overwrite source scripts or a previous output.
    with args.output.open("x", encoding="utf-8") as output:
        output.write(sql)
    print(f"Wrote {args.output}: {args.extra} harmless + 18 scenario comments; no SQL executed.")
