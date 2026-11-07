# SHADOWPRINT FastAPI backend

**Next.js → server-side `/api/backend/*` proxy → FastAPI → verified SQL Server schema.** Follow [Windows setup](../SETUP-WINDOWS.md) for the root `.venv`, pinned dependencies and generated server configuration. `backend/main.py` and `app/main.py` both expose the canonical application factory in `app/api.py`. There are no startup migrations.

## Authentication and compatibility

Every `/api/v1/*` and `/api/*` operation requires the same configured bearer key. Missing configuration fails with 503; missing/invalid credentials fail with 401. Legacy write operations additionally retain `X-Shadowprint-Client: local-workspace` and local host/origin checks. This header alone cannot bypass the bearer boundary. The proxy injects both required credentials/headers server-side and rejects cross-site/foreign-host requests. Browser code has no API key.

`SHADOWPRINT_DATABASE_URL` and `SHADOWPRINT_API_KEY` live in `backend/.env`; Next uses the same key plus `SHADOWPRINT_API_URL` in root `.env.local`. The backend reviewer is `SHADOWPRINT_INVESTIGATOR_ID`, never a browser-supplied identity. Both APIs share one configured engine and reviewer. This is local single-investigator access, not user roles or public production authentication.

## Canonical `/api/v1` contracts

Collections use `{items,total,limit,offset}` and snake_case fields. The browser calls `/api/backend/<path>`; Next forwards to `/api/v1/<path>`.

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


## Existing `/api` workspace contracts

The existing dashboard at `/?mode=workspace` retains its camelCase snapshot API through `/api/backend/legacy/api/*`. The mounted adapter lives under `app/legacy/`; it cannot shadow canonical routes. The root Swagger describes the canonical routes; use the route table below for compatibility contracts.

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


## Transactions and reports

Both repositories use bound SQL parameters and the verified tables/views. Canonical case create/update/associations/audit and notes are atomic. PUT requires `expected_updated_at`, and stale edits return 409. Legacy metadata and status remain separate audited requests; status/review/detection use the verified procedures with their own transactions. A failed second request is surfaced for refresh/retry rather than silently reported saved. Reports retain canonical paginated JSON plus compatibility JSON, formula-safe CSV and escaped printable HTML. There is no server PDF endpoint.

## Verification

Run `.venv/Scripts/python.exe -m pytest backend/tests -q` from the repository root. Without `SHADOWPRINT_RUN_DB_TESTS=1`, engine tests skip explicitly. With it, all modifying suites use owned disposable databases; see [database setup](../DATABASE-SETUP.md). Never point tests at `shadowprint_db`. Bounded current execution results are in [FINAL-INTEGRATION.md](../FINAL-INTEGRATION.md). Earlier `VERIFICATION.md` and `PHASE45-REPORT.md` are historical branch reports.
