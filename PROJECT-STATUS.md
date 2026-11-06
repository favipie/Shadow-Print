# Project status — 2 November 2026

SHADOWPRINT now runs locally as **Next.js -> FastAPI -> Microsoft SQL Server 2025 Express**. All eight frontend destinations use actual API responses in the default database mode. The original fixture interface is retained only at the explicitly labeled `/?mode=demo` route.

## Completed

- Converted the existing FastAPI database implementation to SQLAlchemy `mssql+pyodbc` and ODBC Driver 18, using the existing SQL Server tables, views, procedures and rules.
- Preserved the populated application database: all 22 table hashes and 236 rows match the baseline, including 9 accounts, 28 comments and 11 findings.
- Connected Overview, Account Investigator, Network Explorer, Threat Monitor, Coordination Analysis, Case Management, Reports and Settings.
- Implemented loading/error/retry states, server pagination/filtering, evidence inspection, persisted reviews/cases/notes, report export/printing and audit history.
- Kept the API key server-side with a loopback-only Next.js proxy and host/origin checks. Scanned all 40 generated static assets without finding the configured key.
- Executed 45 backend tests with no skips, 18 frontend tests, TypeScript, ESLint, Prettier, Ruff and the production build successfully. Both real SQL Server browser workflows passed. Desktop, mobile and the generated one-page report were visually inspected.
- Replaced the MySQL CI definition with SQL Server 2025 integration, frontend checks and browser tests. Remote CI execution is recorded separately from the local results.

## Scope and limitations

This remains a local, synthetic, single-investigator workspace. The shared service key is not multi-user authentication or authorization. Do not expose these loopback services publicly without a separate deployment/security design. SQL detection rules are fixed; no NLP, external content feed, automatic moderation, scheduler or background worker was added.

Shared devices remain contextual evidence and contribute no score. Supplied annotations retain their provenance and are not model predictions. The original MySQL SQL/model/reports remain historical academic reference, clearly marked as such.

Browser tests use a separate disposable database, with synthetic mutations retained there. Tested visual sizes are 1440px desktop and 390px mobile in Chromium; exhaustive cross-browser, large-workload and multi-page report layout testing remains future work. Academic report, slides and viva preparation are separate deliverables.

See [executed integration verification](INTEGRATION-VERIFICATION.md), [SQL Server validation](database/sqlserver/VALIDATION.md), [backend verification](backend/VERIFICATION.md) and [Windows startup](SETUP-WINDOWS.md).
