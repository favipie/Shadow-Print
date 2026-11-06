# Project status — 6 November 2026

SHADOWPRINT now runs as Next.js → FastAPI → SQL Server Express with Windows Authentication. The dashboard and seven investigation screens retrieve SQL-backed data. Cases, notes, evidence associations, status decisions and reviews persist through validated API operations with audit history.

Phase 3: all 22 tables, original seed, views and procedures were verified on SQL Server. The original MySQL implementation remains reference material; live MySQL verification is not claimed.

Phase 4–5: modular backend, typed API client/provider, screen integration, SQL report exports, loading/errors, comment pagination, isolated database tests and full browser workflow are implemented. Thresholds remain read-only SQL metadata. The real application does not use browser-local mock persistence.

Verified on 5 November: 11 backend tests passed in a disposable SQL Server database; 26 frontend/artifact tests passed (original 23 plus 3 API-provider tests); all 3 browser workflow/mobile/error tests passed. Desktop/mobile screenshots and the generated A4 report were visually reviewed; the final sample report fits one page. Final build and delivery details are recorded in backend/PHASE45-REPORT.md.

Read-only recheck on 6 November: shadowprint_db still has 22 tables, 9 accounts, 28 comments, 25 annotations, 3 investigations and 11 findings. Scores remain 30/55/50/25/25 for A-001/A-002/A-003/A-004/A-006; others zero. Modifying tests ran only in uniquely named disposable databases, which were removed afterward.

Current scope: local academic project only. Cloud deployment, signup and paid resources were explicitly canceled. The transient deployment-preparation files were removed; the corrected local API environment example is retained.

Local academic continuation on 6 November: added a deterministic T-SQL workload generator and real-engine integration coverage. All 13 backend tests and 26 frontend/artifact tests passed. The isolated generated workload had 21 accounts, 76 comments, 43 annotations and 20 findings in its new run; original records and scores were unchanged. Both generated shared-device controls scored zero, the 90/91-second boundary passed, and repeat import was rejected. Modifying experiments used disposable databases, never shadowprint_db.

Academic report source, examiner walkthrough and viva preparation are available under academic/. The active SQL Server dictionary is generated from its T-SQL schema; the MySQL reference remains intact. See academic/LOCAL-VERIFICATION.md for exact commands and the distinction between new checks and prior build/browser validation.

Remaining academic deliverables: institutional report formatting/export, presentation deck and measured workload/query-plan evaluation. Production authentication, scalable imports/queries and edit-conflict handling are documented limitations, not prerequisites for this local academic scope. No cloud work is planned.
