# Windows startup

Use Node.js 22, pnpm, Python 3.12+, uv, ODBC Driver 18 and the existing SQL Server 2025 Express instance. All startup commands below run from `C:\Users\favian\Projects\Shadow-Print` unless stated otherwise.

If Node is not on PATH, this workspace has a portable runtime:

```powershell
$env:PATH = (Join-Path (Get-Location) '.tools/node-v22.23.4-win-x64') + ';' + $env:PATH
```

A fresh clone should install Node 22 normally; `.tools` is intentionally not committed.

Install dependencies:

```powershell
corepack pnpm install --frozen-lockfile
cd backend
uv sync --locked --python 3.12
```

Local configuration has already been created in ignored files. On a fresh clone, create it once:

```powershell
uv run python configure_local.py --server 'favipie\SQLEXPRESS' --database shadowprint_db
```

This creates a generated shared key without printing it and preserves any existing environment files. It does not touch database contents. The API key must never use a `NEXT_PUBLIC_` prefix.

Start backend in terminal 1:

```powershell
cd C:\Users\favian\Projects\Shadow-Print\backend
uv run python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Start frontend in terminal 2:

```powershell
cd C:\Users\favian\Projects\Shadow-Print
$env:PATH = (Join-Path (Get-Location) '.tools/node-v22.23.4-win-x64') + ';' + $env:PATH
corepack pnpm dev
```

Open http://127.0.0.1:3000. `/health/ready` on port 8000 checks the SQL Server schema and configured investigator. `/?mode=demo` is an explicit browser-fixture fallback. To run the production build, use `corepack pnpm build` followed by `corepack pnpm start` with the backend running.

For tests, see [database setup](DATABASE-SETUP.md) and [integration verification](INTEGRATION-VERIFICATION.md). Browser tests use a separate `_test` database and ports 8001/3002. Never run migrations or reseed against `shadowprint_db`.
