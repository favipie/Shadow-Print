# SHADOWPRINT

A local investigation workspace running **Next.js -> FastAPI -> Microsoft SQL Server 2025 Express**. All original identities and comments are synthetic; signals support human review and do not prove identity or intent.

The default application reads SQL Server through a Next.js server-side API boundary. The original fixture UI remains available explicitly at `/?mode=demo`. Database errors never silently switch to fixtures.

## Start on Windows

Requirements: Node.js 22, pnpm, Python 3.12+, uv, ODBC Driver 18, and the existing populated SQL Server database. See [Windows setup](SETUP-WINDOWS.md).

One-time configuration, from the repository root:

```powershell
corepack pnpm install --frozen-lockfile
cd backend
uv sync --locked --python 3.12
uv run python configure_local.py --server 'localhost\SQLEXPRESS' --database shadowprint_db
```

The configuration helper writes an ignored `backend/.env` and root `.env.local` with the same generated server-only key. It refuses to overwrite existing settings. It never changes the database. Substitute your actual named instance for `localhost\SQLEXPRESS`.

Terminal 1:

```powershell
cd backend
uv run python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Terminal 2, repository root:

```powershell
corepack pnpm dev
```

Open http://127.0.0.1:3000. FastAPI docs are at http://127.0.0.1:8000/docs. Both processes bind to loopback. A portable Node 22 runtime was downloaded into the ignored `.tools/` folder for this workspace; see Windows setup if Node is not on PATH.

## Connected screens

- Overview: actual SQL counts, date filters, daily activity chart and paginated original comments.
- Account Investigator: searchable accounts, SQL scores, persisted findings, original evidence, device observations and related accounts.
- Network Explorer: draggable/zoomable graph from database observations, original login evidence and account navigation.
- Threat Monitor: server-side search, annotation/category/date/review filters, paginated comments, source labels and persistent reviews.
- Coordination Analysis: SQL windows and their original supporting comments, preserving benign shared-device controls.
- Case Management: create/edit cases, preserve evidence/account/finding associations, add notes, record decisions and reject stale updates.
- Reports: actual case scope, evidence timeline, notes, CSV export and a complete printable report assembled across pages.
- Settings: connection state, provenance, immutable SQL rule metadata, new detection runs and persistent audit history.

The browser never receives the shared API key. Next.js forwards only allowlisted operations, validates local host/origin, rejects cross-site requests, and uses uncached server-to-server requests. This remains a local single-investigator service boundary, not production multi-user authentication.

## Database preservation

`shadowprint_db` is populated and must not be migrated, reseeded or reset. SQL Server schema/scripts were recovered read-only from the verified instance. `database/sqlserver/baseline.json` records all 22 table counts and row hashes for preservation checks. Modifying tests run against a separate database ending in `_test`; the initialization script refuses application databases and nonempty test databases.

The original MySQL material remains under `database/` as historical academic reference. It is not the active backend. See [database setup](DATABASE-SETUP.md), [SQL Server validation](database/sqlserver/VALIDATION.md), and [backend contracts](backend/README.md).

## Verification

```powershell
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build
cd backend
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
```

For live SQL Server and browser tests, configure `SHADOWPRINT_TEST_DATABASE_URL` for a disposable seeded `_test` database. See [backend setup](backend/README.md) and [end-to-end verification](INTEGRATION-VERIFICATION.md). The browser suite starts isolated FastAPI/Next.js processes on ports 8001/3002 and refuses to run against the application database.

Project status and remaining limitations are recorded in [PROJECT-STATUS.md](PROJECT-STATUS.md). Historical Phase 2 and MySQL reports are preserved as historical evidence, not current runtime descriptions.
