# Project status

SHADOWPRINT is a synthetic, frontend-first investigation demo for cyberbullying, spam and coordinated-harassment review. Phase 1 dashboard and Phase 2 seven-screen interface are complete. The application has 9 synthetic accounts, 28 comments and explicit benign controls. It is not a moderation system or an identity-resolution system.

The frontend uses Next.js App Router, TypeScript, Tailwind CSS v4, Recharts, Radix UI and React Flow. Local browser storage holds demo reviews/cases/thresholds. There is no FastAPI service, authentication, real account data, live content feed or database-backed UI.

Phase 3 source includes a normalized 22-table MySQL reference model plus generator, views, procedures, documentation and tests. Its real MySQL verification is blocked. SQL Server Express conversion/import is also pending. The original MySQL work is retained for academic reference; a SQL Server implementation will live under `database/sqlserver/`.

Known pending work: unobstructed mobile visual QA, PDF/print verification, MySQL or SQL Server live integration, FastAPI backend, frontend integration, end-to-end testing, academic report, presentation and viva preparation.
