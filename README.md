# SHADOWPRINT

A local academic investigation platform: **Next.js → FastAPI → SQL Server Express**. The existing dashboard and seven screens use SQL-backed records. Cases, notes, evidence associations, status decisions and comment reviews persist in SQL Server with audit history.

All current account/content records are synthetic with explicit provenance. Signals guide human review; shared devices do not prove identity or contribute risk points.

## Run locally

The existing shadowprint_db is populated. **Do not rerun initial migrations or reseed it.**

From the repository root in two terminals:

```powershell
# Terminal 1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Api
# Terminal 2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Service Web
```

Open [SHADOWPRINT](http://127.0.0.1:3000) and [Swagger](http://127.0.0.1:8000/docs). The Web script accepts -NodeExecutable when Node is absent from PATH.

Prerequisites: Node.js 20.9+, pnpm, Python 3.12, SQL Server Express and ODBC Driver 18. See [backend setup](backend/README.md) for dependency installation, virtual environment activation, Windows Authentication, read-only connectivity checks and exact test commands.

## Integrated functionality

- Dashboard: source-derived totals, annotation trends, signal groups, priorities and case counts.
- Accounts: directory search, original history, saved findings, evidence, associations and SQL detection execution.
- Network: React Flow account/device relationships, filters and original supporting records.
- Threats: search, category/provenance/date/review filters, pagination, persistent reviews and CSV export.
- Coordination: SQL sliding-window clusters and shared-device context, including benign controls.
- Cases: create/edit, evidence associations, notes and validated status decisions.
- Reports: saved SQL case summaries, CSV, printable HTML and browser print/Save as PDF.
- Settings: database state, provenance, audit history and read-only SQL rule metadata.

## Source and verification

```text
backend/app/          FastAPI routes, schemas, SQL repository, services, reports
backend/tests/        API, persistence, integrity and rollback tests
src/                  Existing UI with typed API client and SQL provider
tests/                Preserved frontend tests plus API-provider tests
e2e/                  Browser investigation, mobile and error-state tests
scripts/              Windows startup and isolated browser test workflow
database/sqlserver/   Verified 22-table T-SQL implementation
database/             Preserved MySQL reference and academic database material
```

Original seed: 9 accounts, 28 comments, 25 annotations, 6 devices, 8 logins and 3 investigations. Baseline: 11 findings and 53 evidence associations. Scores: A-001=30, A-002=55, A-003=50, A-004=25, A-006=25; others=0.

Annotations, evidence comments and findings are distinct counts. Each rule contributes weight once per account despite multiple matching windows. Repeat detection creates historical runs; the UI displays the latest run. SQL thresholds are authoritative. The old fixture provider remains for regression tests; the real home page has no fixture fallback.

See [execution report](backend/PHASE45-REPORT.md), [project status](PROJECT-STATUS.md), [Windows setup](SETUP-WINDOWS.md) and [SQL Server verification](database/sqlserver/VALIDATION.md).

## Limits

Fixed local demo reviewer; no production authentication, public deployment or real-world identity attribution. The frontend loads a bounded SQL snapshot. Scalable imports, concurrency conflict handling, performance hardening, the final academic report, presentation and viva preparation remain future work.

Reference artwork, local QA outputs, caches, environments and secrets are excluded from Git. The existing repository-owned visual design is preserved.
