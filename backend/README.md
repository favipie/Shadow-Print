# SHADOWPRINT FastAPI backend

The existing FastAPI routes, validation, error handling, report contracts and service-key boundary now target the **verified Microsoft SQL Server 2025 schema** through SQLAlchemy and `mssql+pyodbc`. The Next.js frontend uses these routes through its server-side `/api/backend/*` boundary.

## Local setup

Requirements: Python 3.12+, uv, Microsoft ODBC Driver 18, SQL Server 2025 Express and Windows Authentication.

```powershell
cd backend
uv sync --locked --python 3.12
uv run python configure_local.py --server 'localhost\SQLEXPRESS' --database shadowprint_db
uv run python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The configuration helper creates ignored `backend/.env` and root `.env.local` with a generated shared key, without printing it. It refuses to overwrite existing files. Configure the actual instance through environment settings, not source code. An example URL is:

```text
mssql+pyodbc://localhost\SQLEXPRESS/shadowprint_db?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&LongAsMax=yes
```

Omitting username/password uses Windows Authentication. `TrustServerCertificate=yes` accommodates the local Express certificate. Credentials/service keys must never use `NEXT_PUBLIC_` variables or enter browser bundles. The API reads environment variables and `.env` from the working directory.

Open http://127.0.0.1:8000/docs. Direct API clients need `Authorization: Bearer <key>`. The browser calls Next.js instead; Next.js adds the key only to server-to-server requests. The shared key maps requests to `SHADOWPRINT_INVESTIGATOR_ID` (default `DEMO-ANALYST`). This is local single-investigator access, not production multi-user authentication.

## Database contract and preservation

Never run initial migrations or reseed the populated `shadowprint_db`. Startup only establishes connections and readiness checks. No ORM models recreate schema. SQL Server tables, views, normalization function and procedures were exported read-only from the existing verified instance under `database/sqlserver/`.

Dialect-specific changes include OFFSET/FETCH pagination, SQL Server UTC datetime2 timestamps, integer aggregation of BIT reviews, conditional annotation counts, bound parameters, `OUTPUT INSERTED.id`, row locking with `UPDLOCK,HOLDLOCK`, and `EXEC dbo.run_detection` outside caller-owned transactions. Existing SQL detection logic and scores are preserved. Case mutations and audit records share one transaction; audit failures roll back the mutation. A bounded connection pool validates connections and applies query timeouts.

Original accounts, comments, labels and rule metadata are read-only through the API. Cases, notes, reviews, audit events and new detection runs persist. Existing findings are never overwritten by a new run.

## Routes

All routes below have `/api/v1` prefix and require the service key. Collection responses use `{items,total,limit,offset}` with default limit 50, maximum 100 and bounded offsets. Timestamps are explicit UTC. Date filters require a timezone and are inclusive.

| Route | Behavior |
| --- | --- |
| `GET /accounts` | Paginated ID/handle search and provenance filter |
| `GET /accounts/{id}` | Original account and current SQL score |
| `GET /accounts/{id}/logins` | Device observations |
| `GET /accounts/{id}/related` | Accounts sharing observed devices |
| `GET /accounts/{id}/findings` | Persisted findings across runs |
| `GET /comments` | Text/ID/handle, author/target, category, provenance, annotation method, reviewed and UTC date filters |
| `GET /comments/{id}` | Original comment, annotations, evidence IDs and latest review |
| `POST /comments/{id}/reviews` | Strict boolean `reviewed`, nonblank `reason`, transactional audit |
| `GET /overview` | Filter-consistent totals and daily chart; open cases span all dates |
| `GET /network` | Device relationships with original evidence IDs |
| `GET /coordination`, `/coordination/{anchor}/comments` | SQL windows and original supporting comments |
| `GET /evidence/{id}` | Typed original record |
| `GET`, `POST /detection-runs` | List or create uniquely identified persisted runs |
| `GET /detection-runs/{id}/findings` | Paginated findings |
| `GET /findings/{id}`, `/findings/{id}/evidence` | Finding and original evidence |
| `GET`, `POST /cases` | Search/filter or create investigations |
| `GET`, `PUT /cases/{id}` | Read or replace case fields and associations with stale-update protection |
| `GET`, `POST /cases/{id}/notes` | Read or append notes |
| `GET /cases/{id}/report` | Explicit case scope and paginated evidence timeline |
| `GET /rules`, `/provenance`, `/audit`, `/settings` | Rule metadata, source context, audit history and connection status |

`/health/live` and `/health/ready` sit outside the prefix. Readiness checks the schema, procedure and configured investigator. Missing configuration/database returns 503; there is no silent fixture fallback. SQL/driver exceptions do not expose credentials or query details.

Case writes accept `title`, `description`, `status`, `decision`, `account_ids`, `evidence_ids`, `finding_ids`. PUT additionally requires the last-read `updated_at` as `expected_updated_at`; a concurrent edit or note produces 409. Closing/resolving requires a decision. Unknown/duplicate references are rejected. Notes use `{body}`. Detection uses a new `{id}` and rejects reused IDs.

Reports are JSON contracts rendered by Next.js. The UI assembles all evidence/note pages before printing and all evidence pages before CSV export. Supplied annotations are not model predictions; shared devices contribute zero score. SQL rule metadata is immutable through this API.

## Tests

```powershell
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
```

For live tests, set `SHADOWPRINT_TEST_DATABASE_URL` to a **separate seeded SQL Server database ending in `_test`**. Tests refuse other names. See [database setup](../DATABASE-SETUP.md) for initializing a fresh test database using the exported verified schema. `migrate.py` refuses application databases and nonempty test databases; it never creates/drops databases or removes tables.

The suite checks actual SQL execution: accounts/annotations, aggregation, scores, benign controls, coordination boundaries, findings/evidence, review persistence, cases/status changes/notes/reports, stale edits and transaction rollback. Test cases/runs/audit history are retained in the disposable database. The GitHub workflow uses an isolated SQL Server 2025 container; remote CI status is separate from locally executed tests.

See [VERIFICATION.md](VERIFICATION.md) and the [full integration report](../INTEGRATION-VERIFICATION.md) for execution evidence. The original MySQL SQL files remain as historical reference and are not imported by the active API.
