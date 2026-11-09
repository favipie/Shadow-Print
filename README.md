# SHADOWPRINT

A local academic investigation platform: **Next.js frontend → Next.js API proxy → FastAPI → Microsoft SQL Server Express**. All supplied accounts and content are synthetic, with explicit provenance. Shared devices provide context and never contribute risk points or prove identity.

## Local startup

The existing `shadowprint_db` is populated. Do not rerun initial migrations or reseed it. See [Windows setup](SETUP-WINDOWS.md) for dependencies and configuration, then run from the repository root in separate terminals:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Api
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Web
```

Open [SHADOWPRINT](http://127.0.0.1:3000) and [API docs](http://127.0.0.1:8000/docs).

## Preserved workflows

- `/`: recovered live SQL screens: Overview, Account Investigator, Network Explorer, Threat Monitor, Coordination Analysis, Case Management, Reports and Settings. Collections paginate on the server; case edits reject stale versions.
- `/?mode=workspace`: existing dashboard, navigation, charts and investigation workflows using the authenticated SQL snapshot compatibility API.
- `/?mode=demo`: explicitly labeled browser-fixture demonstration. Neither SQL mode falls back to demo data on connection failure.

Both SQL interfaces preserve loading/error/retry states, original evidence, case/note/review persistence and reports. Canonical reports assemble paginated JSON for CSV/printing; compatibility reports also provide server-rendered CSV and printable HTML.

The browser uses `/api/backend/*`; Next.js injects a server-only bearer key into `/api/v1/*`. Existing workspace consumers use `/api/backend/legacy/api/*`, forwarded to protected `/api/*`. No key or database connection string is sent to the browser. Both processes bind to loopback; this is a single-investigator local service boundary, not production multi-user authentication.

## Database and verification

The 22-table SQL Server schema, constraints, detection procedures and original seed are unchanged. Original seed: 9 accounts, 28 comments, 25 annotations, 6 devices, 8 logins, 3 investigations. Detection: 11 findings; scores A-001=30, A-002=55, A-003=50, A-004=25, A-006=25; others zero. Annotations and findings are distinct counts. MySQL material remains reference-only.

See [current integration results](FINAL-INTEGRATION.md), [backend contracts](backend/README.md), [database setup](DATABASE-SETUP.md) and [SQL verification history](database/sqlserver/VALIDATION.md). Modifying tests create and remove only owned disposable databases; no test uses `shadowprint_db`.

## Academic material and limits

[Report source](academic/REPORT.md), [demonstration walkthrough](academic/DEMO-WALKTHROUGH.md), [viva preparation](academic/VIVA.md) and [SQL data dictionary](database/sqlserver/DATA-DICTIONARY.md) are retained. Institutional document formatting, presentation slides and large-workload query-plan measurements remain separate work. Historical verification reports describe their original branch, not the combined implementation. No cloud deployment is included.

For the isolated HTTPS sign-in demonstration, recovery rehearsal, hosting costs and conditional Vercel release steps, see [hosted demo setup](deploy/README.md).
