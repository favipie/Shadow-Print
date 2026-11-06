# Windows setup

Run Next.js → FastAPI → SQL Server Express locally, without Docker. The existing shadowprint_db is populated: do not rerun migration or seed scripts.

Use Node.js 20.9+, pnpm, Python 3.12, ODBC Driver 18 and the running SQL Server instance. [Backend setup](backend/README.md) contains complete environment, connection and test commands.

From the repository root:

```powershell
pnpm install --frozen-lockfile
uv pip sync --python .venv/Scripts/python.exe backend/requirements.txt
# Terminal 1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Api
# Terminal 2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Web
```

The Web script supports -NodeExecutable 'C:\path\to\node.exe' when an installed Node executable is absent from PATH. Stop each terminal with Ctrl+C.

Open http://127.0.0.1:3000 and http://127.0.0.1:8000/docs. Config lives in ignored backend/.env; copy backend/.env.example and adjust for your local instance.

Read-only connectivity:

```powershell
Push-Location backend
../.venv/Scripts/python.exe -m app.db
Pop-Location
```

Validation:

```powershell
pnpm test
pnpm typecheck
pnpm build
.venv/Scripts/python.exe -m pytest backend/tests -q
```

Full API/browser modifying tests use disposable databases and require permission to create/remove those databases. They never reset shadowprint_db. See the backend README for explicit integration-test commands.

The pnpm store/cache are project-local and ignored because the development environment's shared store was corrupted. esbuild's native-binary setup is explicitly allowed in pnpm-workspace.yaml.

Never commit .env, passwords, tokens, database files, backups, environments or generated QA files. Use ordinary Git commits and fast-forward-safe synchronization; never force-push.
