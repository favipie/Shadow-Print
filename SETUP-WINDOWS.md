# Windows local setup

Requirements: Node.js 22+, pnpm, Python 3.12+, uv, Microsoft ODBC Driver 18, SQL Server 2025 Express and Windows Authentication. Run from the repository root. The existing `shadowprint_db` must not be migrated or reseeded.

```powershell
pnpm install --frozen-lockfile
uv venv --python 3.12 .venv
uv pip sync --python .venv/Scripts/python.exe backend/requirements.txt
.venv/Scripts/python.exe backend/configure_local.py --server 'favipie\SQLEXPRESS' --database shadowprint_db
```

Skip virtual-environment creation if `.venv` already exists. The configuration helper creates ignored `backend/.env` and root `.env.local` with a generated shared key, prints no key, refuses existing files and performs no database writes. Existing installations should reconcile these files with the examples without overwriting their own values. `SHADOWPRINT_DATABASE_URL` selects the SQL Server database; the old `NEXT_PUBLIC_API_URL` is no longer used. Never put a key or database URL in a `NEXT_PUBLIC_` variable.

The backend reads `backend/.env` independently of the current working directory. Username/password omission in the SQLAlchemy URL uses Windows Authentication. Local certificate trust is explicit. Test database creation uses `SHADOWPRINT_SERVER` for the local instance.

Start two terminals:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Api
# Second terminal:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Web
```

Open http://127.0.0.1:3000. The Web script accepts `-NodeExecutable` with a Node executable path. Stop with Ctrl+C. For production-mode local execution: `pnpm build`, then `pnpm start`, with the backend running. These commands do not deploy.

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
.venv/Scripts/python.exe -m pytest backend/tests -q
# Explicitly enable owned disposable SQL integration databases:
$env:SHADOWPRINT_RUN_DB_TESTS='1'
.venv/Scripts/python.exe -m pytest backend/tests -q -o faulthandler_timeout=20
Remove-Item Env:SHADOWPRINT_RUN_DB_TESTS
# Requires the production build and installed Edge:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-e2e.ps1
```

E2E starts isolated services on ports 8001/3002 and checks ownership before browser writes. Set `PLAYWRIGHT_CHANNEL=chromium` if using an installed Playwright Chromium instead of Edge. Windows networking must be permitted for TestClient's asyncio socketpair; a restricted environment can hang before reaching SQL Server. Use a process deadline and normal local networking, rather than repeating a hung run. Current bounded commands/results are in [FINAL-INTEGRATION.md](FINAL-INTEGRATION.md).

Project-local pnpm store/cache, environments, browser artifacts, database files and private settings are ignored. Never commit them. The repository has no required cloud services.
