# FastAPI SQL Server verification — 2 November 2026

The existing FastAPI service was adapted to the populated SQL Server schema, retaining routes, validation, reports and the shared-key boundary. The former MySQL backend verification (39 offline passes, six skipped live tests) is superseded by the executed SQL Server results below.

## Executed checks

- `uv run pytest -q`: **45 passed, 0 skipped** on the Windows SQL Server 2025 Express instance (latest complete backend run: 24.22 seconds).
- `uv run ruff check .`: passed.
- `uv run ruff format --check .`: passed, 16 Python files.
- Dedicated test schema `shadowprint_integration_20261102_test` initialized successfully from the read-only export of the existing SQL Server schema and synthetic records.
- Read-only API smoke checks against the original application database passed: readiness, accounts, comments, overview, network, coordination, cases, audit, rules, provenance and detection runs.
- Original database preservation comparison passed: all 22 table row counts and SHA-256 hashes match the pre-test baseline, covering all 236 rows. Counts remain 9 accounts, 28 comments and 11 findings.

## Live coverage

The six live integration tests use the real pyodbc driver and SQL Server engine. They verify expected scores, benign controls, original comments/labels, aggregation, filtering, network observations, the coordination boundary at 91 seconds, persisted detection runs/findings/evidence and duplicate-run rejection. They also exercise comment review, case creation/status changes, notes, reports, audit history, stale updates, a second application connection pool, foreign-reference rejection and rollback when the audit identity is invalid.

The 39 offline tests cover API authorization, validation, safe errors, response serialization, query construction and migration/configuration guards. Offline tests alone are not database acceptance evidence.

The original `shadowprint_db` received only read operations. All modifying tests, including browser tests, use the separate `_test` database and retain their synthetic test history. Migration refuses application database names and nonempty test schemas.

See [SQL Server validation](../database/sqlserver/VALIDATION.md) for scores and [complete integration verification](../INTEGRATION-VERIFICATION.md) for frontend/browser results and reproduction commands. The shared key is local single-investigator access, not multi-user authentication. Remote CI results must be checked separately from these local executions.
