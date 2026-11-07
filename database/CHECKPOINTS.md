> Historical checkpoint. The active application now uses Next.js -> FastAPI -> Microsoft SQL Server. This document preserves earlier work and its then-current limitations. See [current integration verification](../FINAL-INTEGRATION.md).

# Progress checkpoints

1. Inspected repository instructions, `src/lib/mock-data.ts` and all original normalized frontend fixtures before changes. Frontend source remains untouched.
2. Added schema, detection views, three transactional stored procedures, deterministic seed generator and academic SQL examples.
3. Created integration runner, MySQL version guard, empty-schema migration guard, offline artifact tests, ER generator, data dictionary and normalization/setup documentation.
4. Environment discovery: mysql, mysqld and docker absent from command path; usual Windows MySQL/Docker/XAMPP installation folders not found. Elevated service inspection found no MySQL/MariaDB/Docker services. No database credentials or remote instance were supplied. Real MySQL execution is blocked, not substituted with SQLite or claimed from static checks.
5. Frontend 16-test suite rerun successfully; production webpack build completed successfully. See PHASE3-REPORT.md for final artifact-check results.

## Next milestone and full-project roadmap

Before database acceptance: provision a dedicated MySQL 8.0.16+ instance, run migrate.mjs and verify.mjs, inspect EXPLAIN plans on generated data, and fix any engine-specific failures. Keep exact command/version/output evidence.

FastAPI milestone source is now implemented under `backend/`: environment/.env credentials, connection pooling, validated requests, pagination, UTC serialization, source-aware queries, persisted SQL detection runs and transactional case/review operations with audit history. Offline checks pass; real MySQL tests are included but remain unexecuted locally because the database is unavailable. See `backend/VERIFICATION.md`. Keep the frontend in demo mode until database acceptance and all-screen API integration pass.

Integration milestone: adapt backend DTOs to existing screen contracts; retain explicit demo mode until all seven screens work against the API. Test the full comment → account → network → case → report flow, invalid inputs, empty/error states, persistence and review consistency.

Release/academic milestone: complete unobstructed mobile visual QA and PDF/print verification, then produce the academic report, presentation and viva question bank using actual measured SQL results and screenshots. None of these later milestones is claimed complete by Phase 3 source delivery.
