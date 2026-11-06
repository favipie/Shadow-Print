# SQL Server execution report — 2 November 2026

Status: migration applied after user approval; live SQL Server integration verification passed. FastAPI and database-backed frontend integration are not implemented.

## Target and checkpoint

Server `favipie\SQLEXPRESS`, database `shadowprint_db`, SQL Server 2025 RTM Express 64-bit `17.0.1000.7`, compatibility 170, Windows Authentication. Immediately before migration, read-only preflight confirmed the exact target and **0 user tables and 0 user views/procedures/functions**.

Local Git tag `checkpoint-before-sqlserver-migration-20261102` points to `797df501019c01959971b625ba36ea2a182faa77`. Working tree was clean before conversion. Original MySQL implementation and Next.js source are unchanged. No database or unrelated object was dropped; no credentials were added.

## Delivered implementation

Under `database/sqlserver/`: 001_schema.sql, 002_views.sql, 003_procedures.sql, 004_seed.sql, 005_academic_queries.sql, 006_verify.sql, migrate.sql, convert.mjs, artifacts.test.ts, validate.ps1, updated README.md and this report. Root DATABASE-SETUP.md and PROJECT-STATUS.md describe the verified status.

All 22 original tables are installed: provenance, accounts, posts, comments, devices, login_events, interactions, label_types, comment_labels, detection_rules, detection_runs, findings, evidence, finding_evidence, investigators, investigations, investigation_accounts, investigation_evidence, investigation_findings, case_notes, review_actions, audit_history.

Original PK/FK relationships are retained: source records link to provenance; comments to author, target and post; logins to accounts/devices; annotations to comments/label types; findings to runs, versioned rules, accounts and anchor comments. Evidence has exactly one source and connects to findings/investigations through junctions. Notes, reviews and audit entries link to investigators. Catalog checks found **0 disabled or untrusted foreign keys and 0 disabled or untrusted CHECK constraints**.

Installed: seven views, one text-normalizer function and three procedures: run_detection, review_comment, change_case_status. Procedures use XACT_ABORT, TRY/CATCH and rollback. Detection preserves REP-01, TARGET-01, COORD-01 and THREAT-01. Shared devices do not contribute to scoring.

## Actual database results

| Record | Count |
|---|---:|
| User tables | 22 |
| Original accounts | 9 |
| Original comments | 28 |
| Original annotations | 25 |
| Original devices | 6 |
| Original login events | 8 |
| Original investigations | 3 |
| Detection runs | 1 |
| Findings | 11 |
| Finding/evidence associations | 53 |
| Verification review records | 2 |
| Verification audit records | 4 |

Verified run: `verify-85CEB961-53EA-4A71-9C63-1D96E4733398`, engine `tsql-v1`. Integration log emitted `PASS: engine verification`. Findings by rule: REP-01=6, TARGET-01=1, COORD-01=3, THREAT-01=1.

| Account | Actual score |
|---|---:|
| A-001 | 30 |
| A-002 | 55 |
| A-003 | 50 |
| A-004 | 25 |
| A-005 | 0 |
| A-006 | 25 |
| A-007 | 0 |
| A-008 | 0 |
| U-021 | 0 |

Live assertions passed for:

- Original entity counts, scores and coordination anchor.
- Coordination at 90 seconds included and 91 seconds excluded; repetition at 30 minutes included and +1 millisecond excluded; targeting at 24 hours included and +1 millisecond excluded.
- Unicode whitespace normalization and preservation of 5,000-character content.
- Rejection of invalid author FK, source-free evidence and duplicate comment evidence.
- Exactly 11 persisted findings and exact evidence association equality in both directions.
- Duplicate-run rollback with no extra findings or open transaction.
- Invalid closure rejection and a late audit FK failure rolling back the earlier case update.
- Successful case close/reopen and review/unreview, with four audit events.

Boundary mutations rolled back. The library case remains Open and C-501 remains unreviewed. The run, review history and audit history are deliberately retained; case update time reflects verification activity. Benign shared-device accounts A-007/A-008 score zero. A-006 retains the original repetitive-reminder possible-false-positive scenario.

All academic examples executed: JOIN, self-join, GROUP BY/HAVING, correlated subquery, CTE, recursive CTE with cycle/depth guards, ROW_NUMBER/LAG, score view, indexed range query and rollback transaction. A separate academic rerun returned **exit 0**. No execution-plan performance analysis is claimed.

## Commands executed

From database/sqlserver, using the installed SQLCMD.EXE at `C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE`:

```powershell
sqlcmd -S 'favipie\SQLEXPRESS' -d shadowprint_db -E -C -b -r 1 -f 65001 -i migrate.sql -o migration-execution.log
sqlcmd -S 'favipie\SQLEXPRESS' -d shadowprint_db -E -C -b -f 65001 -i 005_academic_queries.sql -o academic-execution.log
```

The wrapper installed schema/views/procedures/seed in one transaction, committed, then ran 006_verify.sql and 005_academic_queries.sql. The first command's tool response was truncated; its retained log contains the integration PASS and academic results, and subsequent read-only queries confirmed the committed state. The separate academic command returned exit 0. Raw logs are local ignored artifacts.

One follow-up read-only query initially used incorrect column names and failed compilation; correcting it to detection_runs.id and v_account_scores.id/demo_score returned exit 0 and the results above. This was not a migration failure and made no changes.

**Do not rerun migrate.sql against this populated database.** It deliberately refuses nonempty targets. The command documents reproducibility on an approved empty target; no destructive reset script is supplied.

## Static and frontend verification

- Converter generated schema, views, exact original seed and academic SQL from unchanged MySQL sources.
- Microsoft TSql170Parser parsed **all 7 SQL files**, including a final rerun with `powershell -NoProfile -ExecutionPolicy Bypass -File database/sqlserver/validate.ps1` (exit 0). The plain PowerShell invocation was blocked by the local script policy; the process-only option resolved this without changing machine policy. Parsing is syntax-only; the live checks above establish execution.
- `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx database/tests/artifacts.test.ts database/sqlserver/artifacts.test.ts`: **23 passed, 0 failed**, rerun after migration (16 frontend, 4 MySQL artifact, 3 SQL Server artifact checks). Artifact tests verify exact preservation of all original seed values.
- `node node_modules/next/dist/bin/next build --webpack`: **exit 0**, rerun after migration, including TypeScript and static generation.
- `git diff --check`: passed during preparation and checked again before delivery.

## Conversion decisions and outstanding work

ENUM uses NVARCHAR plus CHECK; timestamps use DATETIME2(3); JSON uses NVARCHAR(MAX) plus ISJSON; auto-increment uses IDENTITY. Nullable evidence-source uniqueness uses filtered unique indexes. Restrictive foreign keys remain intact.

SQL Server 2025 RTM regex cannot accept MAX input, so an untruncated scalar normalizer is used. [Microsoft compatibility reference](https://devblogs.microsoft.com/azure-sql/regex-support-for-lob-types-in-t-sql-available-in-azure-sql-sql-server-2025/). Non-demo Unicode case equivalence and large-workload performance need dedicated testing. Derived finding hashes use UTF-16 input and may differ from MySQL; original source IDs and records are unchanged. Audit capture is procedural; production permissions/immutability remain future work.

No unresolved migration execution errors remain. MySQL live verification was not performed. The larger synthetic generator still emits MySQL SQL; a SQL Server workload import path is not delivered here. FastAPI, frontend integration, end-to-end tests, final mobile/print QA, academic report, presentation and viva preparation remain outstanding.
