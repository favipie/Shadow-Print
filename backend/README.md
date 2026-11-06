# SHADOWPRINT FastAPI backend

Local path: Next.js (127.0.0.1:3000) → FastAPI (127.0.0.1:8000) → SQL Server Express using Windows Authentication.

The populated `shadowprint_db` and the 22-table schema are authoritative. Application startup performs no migrations, table creation or seeding. Do not rerun the initial migration. Original source records and the MySQL reference remain intact.

## Python setup

Python 3.12.13 was installed using uv into the ignored project-local .python directory, with a root .venv. Dependencies are pinned in requirements.txt; requirements.in records direct version constraints.

From the repository root, for a fresh local environment:

```powershell
$env:UV_PYTHON_INSTALL_DIR = Join-Path (Get-Location) '.python'
uv python install 3.12
uv venv --python 3.12 .venv
uv pip sync --python .venv/Scripts/python.exe backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Review the local environment file to match your instance. No SQL username/password is used. The ODBC connection encrypts traffic; certificate trust is explicit for the local development instance. Use a validated server certificate and disable trust bypass in a different deployment.

Optional activation (only this PowerShell session's execution policy changes):

```powershell
Set-ExecutionPolicy -Scope Process Bypass
. ./.venv/Scripts/Activate.ps1
```

Activation is unnecessary when invoking .venv/Scripts/python.exe directly.

## Read-only connectivity verification

```powershell
Push-Location backend
../.venv/Scripts/python.exe -m app.db
Pop-Location
```

This prints DB_NAME(), engine version, user table names, seeded counts and current SQL view scores. It makes no writes.

## Start the application

Terminal 1, from repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Api
```

Terminal 2:

```powershell
pnpm install --frozen-lockfile
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Web
```

Open [SHADOWPRINT](http://127.0.0.1:3000), [Swagger](http://127.0.0.1:8000/docs), or [health](http://127.0.0.1:8000/api/health). Stop each process with Ctrl+C.

Equivalent explicit commands:

```powershell
# Run from backend/
../.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Run from repository root in another terminal
node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3000
```

NEXT_PUBLIC_API_URL optionally overrides the browser API URL; rebuild/restart Next.js after changing it. It contains no credentials. CORS permits only the configured localhost origins. Use port 3000 unless you explicitly update SHADOWPRINT_ORIGINS.

## API endpoints

| Method | Path | Behavior |
|---|---|---|
| GET | /api/health | Live connection and table count |
| GET | /api/workspace | Consistent SQL snapshot for all screens |
| GET | /api/dashboard | Totals, annotated/detected counts, trends, priorities |
| GET | /api/accounts | Search q, offset, limit |
| GET | /api/accounts/{id} | Profile, history, saved findings, related accounts |
| GET | /api/comments | Search q, account/category/reviewed filters, pagination |
| GET | /api/comments/{id} | Original text, annotations, provenance and review |
| POST | /api/comments/{id}/review | Validated review through existing procedure |
| GET | /api/network | Account/device nodes, evidence edges, kind/account filters |
| GET | /api/coordination | SQL coordination windows and shared-device context |
| GET | /api/evidence/{id} | Original comment/login and associated findings |
| GET | /api/findings | Latest saved run's findings and evidence |
| POST | /api/detection/runs | Existing detection procedure, new immutable run |
| GET, POST | /api/cases | Paginated search / transactional creation |
| GET, PUT | /api/cases/{id} | Case detail / metadata and evidence associations |
| PATCH | /api/cases/{id}/status | Existing status procedure; closure needs decision |
| POST | /api/cases/{id}/notes | Note and audit entry in one transaction |
| GET | /api/reports/{id} | SQL report; format=json, csv or html |
| GET | /api/settings | Health, provenance, read-only rule metadata |

Write requests require the X-Shadowprint-Client: local-workspace header. This is a local cross-origin request guard, **not authentication**. Swagger write examples require supplying that header through a client; the frontend supplies it automatically. The fixed reviewer comes from server configuration, never browser input.

## Transactions and authority

SQLAlchemy Core parameterized SQL uses the existing schema, without a conflicting ORM model. Reads use a short SERIALIZABLE snapshot transaction. Detection, reviews and status calls use a DBAPI autocommit connection because the verified stored procedures own their transactions and reject nested caller transactions. See [SQLAlchemy's SQL Server documentation](https://docs.sqlalchemy.org/en/20/dialects/mssql.html).

Case creation, metadata/evidence updates and notes use application transactions with audit entries. Editing details and changing status are separate audited operations because the existing procedure owns its transaction. A partial failure is surfaced explicitly; refresh before retrying. Records are never silently treated as saved after a failed request. Concurrent reviewers currently use last-write-wins metadata; versioned edit conflicts are future work.

Settings are read-only: SQL v1 thresholds remain authoritative. Scores count each rule once per account even when multiple windows produce findings. Findings show the latest saved run; repeat detection creates historical runs rather than replacing the original 11 findings.

All labels retain provenance. Annotation counts are not finding counts. Device-only links carry no risk score. Reports escape HTML and neutralize spreadsheet formulas. HTML reports support browser print/Save as PDF; there is no separate server PDF endpoint.

## Tests and safety

From repository root:

```powershell
# Pure backend validation/report/security tests; integration tests skip unless explicitly enabled
.venv/Scripts/python.exe -m pytest backend/tests -q

# Creates a uniquely named disposable database, verifies persistence/procedures, then removes only that database
$env:SHADOWPRINT_RUN_DB_TESTS='1'
.venv/Scripts/python.exe -m pytest backend/tests -q
Remove-Item Env:SHADOWPRINT_RUN_DB_TESTS

# Existing tests plus API provider tests and original SQL artifacts
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx database/tests/artifacts.test.ts database/sqlserver/artifacts.test.ts

# Browser workflow: isolated database, FastAPI 18000, Next.js 13000, installed Microsoft Edge
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-e2e.ps1

# Production frontend validation
node node_modules/next/dist/bin/next build --webpack
```

Disposable databases must match shadowprint_test_ followed by 32 hexadecimal characters and have a local ownership marker before cleanup. Test setup uses the existing schema/seed only in that new database. No test resets, migrates or reseeds shadowprint_db. Browser tests refuse a non-test API target. Tests need CREATE/DROP DATABASE permission; normal application use does not.

The original Phase 2 provider/fixtures remain as regression-test support. The real home page uses SqlProvider exclusively and has no offline fixture fallback.

## Scope and limitations

This is a local academic application. It has no production login, roles, external identity attribution or public deployment. Bind the API to loopback. Windows SQL permissions are inherited from the process identity; run with a dedicated least-privilege Windows principal when preparing another environment. Required rights: SELECT on the existing application tables/views; EXECUTE on run_detection/review_comment/change_case_status; INSERT/UPDATE on investigations; INSERT/DELETE on investigation_accounts and investigation_evidence; INSERT on case_notes and audit_history. No runtime DDL or source comment/account write permissions are required. Creating users/roles is deliberately outside automatic startup.

The frontend loads a bounded SQL workspace snapshot and paginates the comment UI locally; list APIs also expose offset/limit. Snapshot size is capped and errors explicitly rather than silently truncating records. Large dataset imports, scalable server-side graph paging and benchmarks remain future work. Searches run in memory on the already-loaded small dataset, so no network debounce is needed. No real/public dataset has been imported.

See PHASE45-REPORT.md for actual executed checks, environment issues and remaining work.
