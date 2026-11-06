# Integration verification — 2 November 2026

The implemented and executed path is **Next.js 16.4.2 / React 19.3.1 -> FastAPI 0.162.0 -> SQLAlchemy 2.1.6 / pyodbc 5.3.0 -> Microsoft SQL Server 2025 Express 17.0.1000.7**. Local access uses Windows Authentication and ODBC Driver 18.

## Executed results

| Check | Result |
| --- | --- |
| Backend `uv run pytest -q` | 45 passed, zero skipped, including six live SQL Server tests |
| Backend Ruff lint / format | Passed; 16 Python files |
| Frontend `corepack pnpm test` | 18 passed, zero skipped |
| `corepack pnpm typecheck` | Passed |
| `corepack pnpm lint` | Passed |
| `corepack pnpm format:check` | Passed |
| `corepack pnpm build` | Production webpack build passed |
| `corepack pnpm test:e2e` | Both Chromium browser workflows passed against the real test database |
| Original database read-only API smoke | All queried endpoints returned 200 |
| Original database preservation | All 22 table hashes/counts unchanged, covering 236 rows |
| Client secret scan | Configured service key absent from all 40 generated static files |
| Visual review | Desktop overview/report and 390px mobile account inspected; no horizontal mobile overflow |
| Printable report | Browser PDF generated; one page rendered and inspected, with status, decision, original evidence and saved note |

The frontend unit tests include the retained 16 fixture/interaction tests and two server-boundary tests. They do not replace the SQL-backed browser tests. The 39 offline backend tests and six live tests are distinguished in [backend verification](backend/VERIFICATION.md).

## Database preservation

The original `favipie\SQLEXPRESS` / `shadowprint_db` was used only for read-only connectivity, catalog export, API smoke checks and digest comparison. It remains at 22 tables, 9 accounts, 28 comments and 11 findings. All records, including original cases, notes, reviews, audit history and findings, match [the baseline](database/sqlserver/baseline.json).

The catalog export recovered the existing SQL Server implementation without deriving a new ORM schema: seven views, three procedures and one normalization function. The exported schema/seed successfully initialized only `shadowprint_integration_20261102_test`. Every modifying integration/browser test ran there. No original database migration, reseed, reset or finding overwrite was performed. See [SQL validation](database/sqlserver/VALIDATION.md) for the preserved score table.

## Browser acceptance workflow

The production Next.js server and real FastAPI process ran on isolated ports 3002 and 8001. A before-each guard verified that the backend database name ended in `_test`.

The first test loaded actual dashboard counts, searched C-352, opened its account and confirmed score 50, expanded a persisted THREAT-01 finding and original evidence, explored network login evidence and a linked account, created a case carrying C-352 evidence, saved an investigator note, changed case status, marked the comment reviewed, refreshed and verified persistence. It opened the scoped report, assembled complete evidence/notes, downloaded CSV and produced a printable PDF. A separate API read confirmed the saved note. No page exceptions, browser authorization headers or direct browser requests to FastAPI were observed.

The second test verified comment pagination across all 28 records, the 14-record Spam filter, coordination supporting comments, SQL Server Settings and audit history, cross-origin POST rejection, visible API failure and successful Retry, mobile navigation and the zero-score library control. It checked mobile horizontal overflow explicitly.

Earlier browser failures exposed an overly strict internal Host comparison, test dropdown selectors, a save/navigation race in the test, and the Next.js route-announcer alert selector. These were corrected before the passing run. Browser tests now use the production build, await saved state, and capture screenshots after print-to-screen layout settles.

Local artifacts are in ignored `test-results/`: desktop/mobile screenshots and an investigation PDF. They contain disposable test-case names, not application-database mutations. Generated artifacts are not source files and are not committed.

## Reproduce checks

From the repository root, with Node 22/pnpm and uv installed:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build
corepack pnpm typecheck
cd backend
uv sync --locked --python 3.12
uv run ruff check .
uv run ruff format --check .
$env:SHADOWPRINT_TEST_DATABASE_URL = 'mssql+pyodbc://favipie\SQLEXPRESS/shadowprint_integration_20261102_test?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&LongAsMax=yes'
uv run pytest -q
cd ..
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

On this workspace, add `.tools/node-v22.23.4-win-x64` to PATH as shown in [Windows startup](SETUP-WINDOWS.md). Its downloaded browser binaries are in `.tools/browsers`; set `$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.tools/browsers'` to reuse them. A fresh clone can use Playwright's default installation directory instead. Initialize a **new empty disposable test database** following [database setup](DATABASE-SETUP.md); never initialize the populated application database.

## Exact Windows startup

Local ignored environment files have already been configured with matching generated service keys and the original application database. No migration is required.

Terminal 1:

```powershell
cd C:\Users\favian\Projects\Shadow-Print\backend
uv run python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd C:\Users\favian\Projects\Shadow-Print
$env:PATH = (Join-Path (Get-Location) '.tools/node-v22.23.4-win-x64') + ';' + $env:PATH
corepack pnpm dev
```

Open http://127.0.0.1:3000. FastAPI docs: http://127.0.0.1:8000/docs. For production mode locally, replace `corepack pnpm dev` with `corepack pnpm build` then `corepack pnpm start`.

## Remaining limitations

The local service key identifies one investigator; it is not production multi-user authentication. Local host/origin checks and a server-only key are verified, but public deployment requires additional authentication, authorization and operational controls. No public deployment is part of this work.

Screens use actual SQL data while preserving the existing styling/navigation; fixture mode is opt-in and labeled. SQL rule metadata is immutable. Graph pagination shows the currently loaded observations, with an accessible evidence list. Reports fetch every evidence/note page before export/printing; visual print acceptance used a one-page case. Large datasets, exhaustive browser coverage and multi-page layout stress testing were not claimed. Academic report/presentation deliverables remain separate.

`.github/workflows/backend.yml` provisions SQL Server 2025 and runs the complete checks, including browser tests. Local passing results above do not imply remote CI success; check the GitHub Actions run for the pushed commit.
