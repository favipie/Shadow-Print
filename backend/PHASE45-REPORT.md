> Historical source-branch report. Current merged-branch verification is recorded in [FINAL-INTEGRATION.md](../FINAL-INTEGRATION.md).

# Phase 4–5 execution report — 6 November 2026

## Delivered

SHADOWPRINT now implements Next.js → FastAPI → SQL Server Express. The original UI and navigation are preserved. All major screens receive a SQL-backed workspace snapshot; the real application has no mock-data fallback. Source fixtures and the old provider remain for regression tests and original-data comparison.

Created backend modules: config.py, db.py, schemas.py, repository.py, services.py, reports.py and main.py. Added pinned requirements, an environment example, backend tests, an ownership-guarded disposable database helper and detailed backend/README.md. Created the typed frontend API client and SQL provider, integrated the existing dashboard/seven screens/shared evidence controls, added API-provider tests, Playwright tests, Windows startup/test scripts and next.config.ts. Updated repository setup/status documentation. Prior verified Phase 3 T-SQL source is included in the delivery checkpoint; MySQL reference files remain unchanged.

No new schema or migration was applied to shadowprint_db. The application never creates tables at startup. Existing SQL procedures handle detection, reviews and case status changes. Case creation, metadata/evidence updates and notes use parameterized transactions with audit entries.

## Database and dependency verification

Read-only SQLAlchemy/pyodbc connectivity succeeded before modifying API operations were implemented. Final read-only check on 6 November confirmed:

- Server favipie\SQLEXPRESS; database shadowprint_db; SQL Server 2025 Express 17.0.1000.7; Windows Authentication.
- All 22 user tables; 9 accounts, 28 comments, 25 annotations, 3 investigations and 11 findings.
- Scores A-001=30, A-002=55, A-003=50, A-004=25, A-006=25; A-005/A-007/A-008/U-021=0.
- Original data was not reseeded, migrated or used for modifying tests. Benign shared-device controls remain zero-scored.

Python 3.12.13 was installed with uv into project-local .python and .venv. Exact dependency versions are pinned in requirements.txt, including FastAPI 0.162.0, SQLAlchemy 2.0.57, pyodbc 5.3.0, Pydantic 2.14.3, Uvicorn 0.54.0, Pytest 9.2.0 and HTTPX 0.28.1.

## Executed verification

- **11 backend tests passed** against a newly created, uniquely named disposable SQL Server database. Coverage includes connectivity, counts/scores, all read endpoints, pagination/search, original evidence, case and review persistence through fresh connections, metadata rollback, late audit failure rollback, case-status procedure, detection reruns, CSV formula protection and HTML escaping.
- **26 frontend/artifact tests passed**: all original 23 retained, plus 3 API-provider tests covering explicit connection failure/retry, confirmed server persistence and failed-save behavior without optimistic success or browser-local storage.
- **3 Playwright browser tests passed**: complete investigation journey, mobile navigation/filtering/pagination/benign control, and API outage/retry. The full journey navigates dashboard → suspicious comment → account findings → React Flow → evidence → new case → note → review → reload → persisted state → CSV and printable report.
- Production webpack build completed with **exit 0** on 6 November, including TypeScript and static page generation.
- A read-only Edge browser smoke check of the production build against shadowprint_db passed on 6 November (exit 0). Dashboard and SQL settings rendered; the API returned 22 tables, 9 accounts, 28 comments, 25 annotated comments, 24 detection-evidence comments, 11 findings and 3 open cases. Browser API writes were blocked, and both temporary services were stopped afterward.
- Desktop/mobile screenshots were visually inspected. The final 390px mobile dashboard, review queue and settings have no page-level horizontal overflow; tables retain horizontal scrolling. Next's development indicator is disabled so it does not obstruct the UI.
- The actual HTML report was printed by Chromium to A4 PDF, rendered with Poppler and visually inspected. The final sample is one page with evidence, notes, decision and limitations intact. This verifies browser printing; no server PDF endpoint is claimed.

The final browser run completed in 40.2 seconds. Its test database and test services were removed by the guarded cleanup. Raw screenshots, PDF, traces and logs are ignored local artifacts under qa/phase45, test-results, playwright-report and backend/.test-output.

## API and behavior

The full endpoint inventory and exact commands are in backend/README.md. API groups cover /api/health, /workspace, /dashboard, /accounts, /comments, /network, /coordination, /evidence, /findings, /detection/runs, /cases, /reports and /settings.

Review and status writes use the original transaction-owning procedures through an autocommit connection; new case metadata/evidence/notes use explicit application transactions. Details and status are separate audited operations, with partial failure clearly reported. The UI refreshes confirmed SQL state after successful writes.

Annotation counts, detection-evidence comments and findings are distinct metrics: baseline totals are 25 annotated comments, 24 detection-evidence comments and 11 findings. Rule weights count once per account even with multiple matching windows. Thresholds remain authoritative, read-only SQL values. Devices alone contribute zero points. Reports and evidence retain provenance.

## Issues found and resolved

- Shared pnpm store SQLite corruption blocked browser dependencies. Dependencies were reinstalled into a project-local ignored store/cache; pnpm-workspace.yaml records that configuration and explicitly allows esbuild's setup.
- The mobile browser test exposed filter labels that included option text. Controls now reference explicit label IDs. All browser tests passed after the fix.
- The outage test initially matched both the app alert and Next's route announcer; its selector now checks the actual error content.
- Chart animation produced incomplete capture frames; chart rendering is now stable. Graph filtering excludes unrelated nodes, and stale frontend-only labels were corrected.
- The first printed sample left a mostly empty second page. Print spacing was adjusted and the regenerated one-page PDF was rendered and inspected.
- The resumed shell lacked Node on PATH. The installed Node 24.22.1 executable was used for the successful build; start-local.ps1 supports -NodeExecutable for this situation.

Non-failing warnings: the pinned Starlette TestClient reports an HTTPX deprecation warning; React Flow 12 emitted initial container-size warnings during the development browser run, then rendered and passed graph/evidence interaction checks. No runtime exception was observed in the full investigation browser test.

## Limits and next work

No production authentication/authorization or cloud deployment is implemented. The API uses a fixed local reviewer and loopback binding. CORS and a custom request-header guard restrict browser writes but do not replace authentication. SQL privileges are inherited from the Windows process identity; least-privilege deployment requirements are documented, not silently provisioned.

The UI uses a bounded SQL snapshot with local comment pagination; list APIs also expose offset/limit. Large imports, scalable server-side graph paging, workload performance and multi-user edit conflict detection remain future work. Metadata edits currently use last-write-wins semantics. Printing is browser-based; the sample PDF is QA output, not a server-export feature.

The later cloud-deployment exploration was canceled on 6 November at the user's request. No deployment or cloud resource was created. Work continues solely as a local academic project. Academic report source, demo walkthrough and viva notes are now under academic/; final report formatting and presentation remain pending. See academic/LOCAL-VERIFICATION.md for subsequent generator verification.
