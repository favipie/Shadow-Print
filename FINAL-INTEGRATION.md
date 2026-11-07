# Final recovery integration — 7 November 2026

Branch: `integrate-recovery-sqlserver`. This continues the existing merge of verified main `fbf3f07e6058b720b4ce5255c16df9ea33734abb` and recovery `d5524b097cf0daa962f688700121ecb089b40645`; no branch restart, reset or force-push was used.

## Implementation

- All original merge conflicts are reconciled. The previously resolved SQL Server schema is preserved. The authoritative `001_schema.sql`, `002_views.sql`, `003_procedures.sql` and `004_seed.sql` are byte-for-byte unchanged relative to main. Redundant recovery detection/seed definitions are excluded.
- `/` exposes the recovered live Overview and seven investigation screens. `/?mode=workspace` preserves the existing dashboard, navigation and SQL-backed investigation workflows. `/?mode=demo` explicitly labels fixture data; SQL failures never silently switch to fixtures.
- Browser clients use same-origin `/api/backend/*`. The Next.js server injects the service key, allowlists operations, rejects foreign hosts/origins/cross-site requests and forwards uncached requests to FastAPI `/api/v1/*`. Compatibility `/api/backend/legacy/api/*` maps to `/api/*`, retaining camelCase snapshots and CSV/HTML/PATCH behavior.
- Both API families require the bearer key and share the configured SQL engine/reviewer. Legacy writes also require their original local-workspace header. Canonical case changes, associations and audit events commit atomically; stale versions return 409. Legacy metadata and procedure-owned status remain distinct audited operations.
- Environment examples, local startup/test scripts, pnpm/uv locks and setup documents match this architecture. Python locks match the tested installed versions. The browser-test wrapper generates an ephemeral key and checks an exact owned database marker. The read-only exporter cannot overwrite the verified SQL source directory.

## Executed verification

| Check | Actual result |
| --- | --- |
| Python compile/import and pytest collection | Passed; 65 tests collected |
| Full backend unit/contract/SQL tests | 65 passed, 0 failed, 0 skipped in 51.77 seconds |
| Frontend/provider/workflow/proxy tests | 22 passed, 0 failed, 0 skipped |
| MySQL reference + SQL Server artifact tests | 7 passed, 0 failed, 0 skipped |
| ESLint with zero-warning limit | Passed, no warnings/errors |
| Next.js production webpack build | Passed, including TypeScript and route generation |
| Standalone TypeScript check | Route type generation and `tsc --noEmit` passed |
| Edge browser E2E | 5 passed, 0 failed, 0 skipped in 1.9 minutes. The wrapper exited successfully and cleaned up its owned database. |
| Git conflicts and staged content | No unmerged entries; no conflict markers, private .env files, caches or credential signatures found |

Backend execution used a 180-second subprocess deadline, `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`, `SHADOWPRINT_RUN_DB_TESTS=1` and `faulthandler_timeout=20`. The normal Windows networking permission avoids the previously diagnosed asyncio socketpair sandbox hang. All 65 tests ran rather than skipping database checks. One upstream Starlette/httpx deprecation warning remains; it did not fail tests.

Frontend/artifact tests used a 120-second deadline. TypeScript/lint used 90-second deadlines. Build used a 300-second deadline. Browser tests have 180 seconds per test and 600 seconds globally.

Commands from repository root (wrapped in bounded subprocesses during execution):

```powershell
.venv/Scripts/python.exe -m compileall -q backend/app backend/tests backend/testing.py backend/migrate.py
.venv/Scripts/python.exe -m pytest backend/tests --collect-only -q
# With PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 and SHADOWPRINT_RUN_DB_TESTS=1:
.venv/Scripts/python.exe -m pytest backend/tests -q -o faulthandler_timeout=20
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx database/tests/artifacts.test.ts database/sqlserver/artifacts.test.ts
node node_modules/eslint/bin/eslint.js src tests e2e playwright.config.ts --max-warnings 0
pnpm typecheck
node node_modules/next/dist/bin/next build --webpack
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-e2e.ps1
uv lock --project backend --check --offline
git diff --name-only --diff-filter=U
git diff --cached --check
```

## Failures diagnosed during integration

The initial offline dependency install failed because the local cache lacked lint packages; online frozen-lockfile installation succeeded and passed pnpm's supply-chain policy check. Both lockfiles were reconciled with the supported/tested dependencies.

The initial E2E startup guard used a web URL parser that rejected SQL Server named-instance syntax; it now validates the SQLAlchemy URL/database name without losing the ownership check. The next browser run passed the recovered case lifecycle but exposed a compatibility database-label error: snapshot settings used the old configuration default although the mounted repository was using the correct disposable engine. The label now comes from `SELECT DB_NAME()` on that same snapshot connection, with an integrated API regression assertion. Two test strings also required UTF-8 repair. The classic report test also parsed the page query instead of the hash after creating a case. Correcting the test to read the case ID from the fragment verified actual report retrieval. All five browser tests then passed against the production build.

## Database safety and security scope

No migration, reset, reseed, destructive statement or application mutation was executed against `shadowprint_db`. All modifying checks used helper-created `shadowprint_test_<32 hex>` databases, installed the unchanged verified schema/seed and cleaned up only owned databases. Tests cover original seed counts/scores, benign device controls, coordination boundaries, case/review persistence, evidence/report associations, stale updates, invalid references and late audit-failure rollback.

The configuration rejects empty, short, whitespace-only and example service keys. Four regression cases verify this before the application can serve requests. The environment examples contain no usable key. No key is stored in client code. Missing/invalid backend credentials fail closed; the compatibility header alone cannot authorize requests. This remains a loopback-only, single-investigator academic application. Shared service-key access is not multi-user authorization, and legacy metadata edits retain last-write-wins semantics. No public deployment/security claim is made.

Remote CI has not been observed for this merge. Its credential-free Ubuntu job runs unit/frontend/build checks; Windows-auth SQL and browser integration remain explicitly local. Historical reports retain their original source-branch results. Institutional report formatting, slides, extensive browser coverage and measured large-workload query plans are outside this merge.

This report covers local verification of the integration branch. The merge commit retains both source parents.
