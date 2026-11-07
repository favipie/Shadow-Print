> Historical checkpoint. The active application now uses Next.js -> FastAPI -> Microsoft SQL Server. This document preserves earlier work and its then-current limitations. See [current integration verification](../FINAL-INTEGRATION.md).

# SHADOWPRINT Phase 3 — MySQL

This directory adds a relational implementation without changing frontend behavior. FastAPI and browser-to-database integration are not implemented. Never connect a browser directly to MySQL.

## Prerequisites and setup

Use Oracle MySQL **8.0.16 or newer**, preferably a supported MySQL 8.4 installation. Earlier 8.0 releases do not enforce CHECK constraints. MariaDB is not a verified substitute. Use InnoDB, utf8mb4, UTC and strict SQL mode. Reference: https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html

In an administrator MySQL session, create a dedicated empty schema:

```sql
CREATE DATABASE shadowprint_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

Run the following from `shadowprint/database` in PowerShell. Use a local account granted DDL, routine, view and DML privileges **only on this dedicated schema**. Do not use production data or commit credentials.

```powershell
pnpm --ignore-workspace install --frozen-lockfile
$env:MYSQL_HOST = '127.0.0.1'
$env:MYSQL_PORT = '3306'
$env:MYSQL_DATABASE = 'shadowprint_demo'
$env:MYSQL_USER = 'your_local_database_user'
# Supply MYSQL_PASSWORD through your local secret mechanism.
node migrate.mjs
node verify.mjs
```

Alternatively, open the MySQL command-line client in this directory (use `-p` to prompt for a password), select the empty schema and execute:

```sql
SOURCE 001_schema.sql;
SOURCE 002_detection.sql;
SOURCE 003_seed.sql;
SOURCE 004_academic_queries.sql;
CALL run_detection('demo-run-1');
CALL review_comment('C-352','DEMO-ANALYST',TRUE,'Context inspected in academic demo');
```

Files are ordered migrations for a fresh schema, not rerunnable destructive resets. The runner refuses a nonempty schema. MySQL DDL implicitly commits: a failed migration can leave a partial schema. Diagnose the error, then create a **new dedicated schema** and rerun; the scripts never drop a database or disable foreign keys. Seed DML runs in one transaction. Routine calls own their transactions; do not call them within another transaction. Reusing a detection run ID fails and rolls back rather than duplicating results.

## Deterministic seed and generator

From the application root:

```powershell
node node_modules/tsx/dist/cli.mjs database/generate.ts
node node_modules/tsx/dist/cli.mjs database/generate.ts 10000 42 database/generated.sql
node node_modules/tsx/dist/cli.mjs --test database/tests/artifacts.test.ts
```

The first command reconstructs the checked-in `003_seed.sql` directly from `src/lib/investigation-data.ts`. It preserves all original IDs, timestamps, bodies, source labels, six devices, eight logins and three cases. `src/lib/mock-data.ts` was inspected: its chart totals derive from these comments, while its authored event summaries are presentation metadata, not additional source records. No synthetic findings are falsely seeded as SQL executions.

Seed counts: **9 accounts, 9 scaffold posts, 28 comments, 25 supplied labels, 6 devices, 8 login events, 36 evidence items, 3 investigations, 7 case-account associations, 20 case-evidence associations, 1 case note, 4 rule definitions**. Reviews, findings and audit history start empty. Original fixtures contain no likes/shares; none are invented in the exact demo seed.

With a positive extra count N, output contains the entire demo plus N unique harmless comments and 18 authored scenario comments: eight duplicate promotions, six labeled targeting comments, one redacted threat example and three synchronized comments from distinct accounts. It also adds at least 12 generated accounts and one synthetic like. Use the generated file **instead of** `003_seed.sql` in a fresh schema; do not append it to an already seeded schema. `verify.mjs` is specifically for the exact small demo; larger datasets need their own count expectations. The generator uses an explicit seeded LCG, stable IDs and fixed UTC dates; identical parameters produce identical bytes. The seed is not a realistic prevalence estimate or a benchmark dataset.

## Detection and evidence

Version-1 rules normalize case and whitespace (binary comparison after normalization). REP-01 finds at least five equal comments from one author within 1,800 seconds. TARGET-01 finds six supplied harassment labels by one author to one target within 86,400 seconds. COORD-01 finds three distinct authors posting the same normalized body to one target within 90 seconds. THREAT-01 surfaces a supplied threat label. Windows are inclusive and anchored on original records, not arbitrary clock buckets. Overlapping qualifying windows are retained; account scores count each distinct rule once. SQL templates and rule metadata are versioned together; editing thresholds in the frontend has no database effect.

Expected SQL results on the demo: two repetition accounts (A-004 and A-006), one targeting account (A-002), one coordination anchor (C-410) covering A-001/A-002/A-003, and one supplied threat-label account (A-003). One detection run creates **11 findings** including overlapping repetition windows; all have original evidence. Scores: A-001 30, A-002 55, A-003 50, A-004 25, A-006 25; everyone else 0. Scores are bounded demo weights, not calibrated probabilities.

The library accounts A-007/A-008 share D-006 and both score zero. Devices never enter the score or detection views. Even supporting behavioral evidence cannot establish common identity. Repeated reminders (A-006) deliberately illustrate a possible false positive requiring human review.

## Provenance and public datasets

`provenance` records source kind, name, version, license and description. Every account/comment has a unique source-record mapping; labels independently identify provenance and method. `demo-v1` is the original synthetic scenario, `scaffold-v1` identifies invented relational posts, and `generated-v1` records workload seed/count. No public dataset was imported. A future import must register its URL/license/version and retain source IDs; a public toxicity annotation must not be presented as a threat prediction or evidence about synthetic identities. No real-world identity joins are inferred.

## Verification and limitations

`verify.mjs` executes real MySQL queries and checks counts, expected scores, benign controls, the 91-second boundary, foreign-key and CHECK rejection, all academic examples, procedure-created evidence, review state and case/audit transactions. It requires a disposable exact-demo schema and deliberately retains test detection/review/audit history. A subsequent run uses a new run ID. This is an executable integration suite, not an assertion that it ran in the delivery environment.

`tests/artifacts.test.ts` runs without MySQL and checks byte reproducibility, original fixture coverage, generated workload counts, SQL literal safety and procedure parsing. It does **not** validate SQL execution semantics. See `PHASE3-REPORT.md` for executed results and blockers.

Direct table writes can bypass procedural audit capture. Before production integration, use a separate application principal with procedure execution/read privileges and restrict mutable/audit tables; DB administrators are not tamper-proof. Authentication, append-only audit enforcement, deletion/retention policy and imported-content immutability need backend hardening. Current analytical views normalize TEXT during self-joins; author/time and target/time indexes narrow windows, but large workloads need measured EXPLAIN plans before adding materialized hashes or claiming performance.

See `ER.md`, `DATA-DICTIONARY.md`, `NORMALIZATION.md` and `CHECKPOINTS.md`.
