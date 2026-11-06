# SQL Server validation — 2 November 2026

Verified locally using Windows Authentication, Microsoft ODBC Driver 18, SQLAlchemy and `mssql+pyodbc`.

| Property | Observed |
| --- | --- |
| Instance | `favipie\SQLEXPRESS` |
| Application database | `shadowprint_db` |
| Product | SQL Server 2025 Express |
| Version | `17.0.1000.7` |
| Tables | 22 |
| Accounts | 9 |
| Original comments | 28 |
| Persisted findings | 11 |
| Total rows across tables | 236 |

The existing database was inspected and exported read-only. No migration, reseed, reset, data deletion or finding replacement was performed against it. The exported catalog includes seven views, three procedures and one function. The exported scripts were successfully applied only to a new disposable database, `shadowprint_integration_20261102_test`.

## Preservation evidence

[baseline.json](baseline.json) stores the pre-test counts and SHA-256 digest of canonically sorted row data for every table. After backend and frontend implementation, read-only export with `--digest-only` produced an identical digest for all 22 tables, including investigations, case notes, review actions, audit history, detection runs and findings. The local comparison output was:

```text
Original database read-only: ('shadowprint_db', '17.0.1000.7', 22, 9, 28, 11)
Preservation PASS: all 22 tables, all 236 rows and SHA-256 hashes unchanged.
```

## Preserved scores and controls

| Account | SQL score |
| --- | ---: |
| A-001 | 30 |
| A-002 | 55 |
| A-003 | 50 |
| A-004 | 25 |
| A-005 | 0 |
| A-006 | 25 |
| A-007 | 0 |
| A-008 | 0 |
| U-021 | 0 |

The shared-library accounts A-007 and A-008 remain benign at zero. Shared devices provide context and do not increase scores. Live tests verify the single C-410 coordination window and its three supporting comments; moving C-412 beyond the 90-second boundary removes the window in a transaction that is rolled back in the test database.

## Executed acceptance

Backend: **45 passed, zero skipped**, including all six real SQL Server integration tests. Live coverage includes query execution, aggregation, findings, evidence, persistence and transaction rollback. See [backend verification](../../backend/VERIFICATION.md) and [frontend/browser verification](../../INTEGRATION-VERIFICATION.md).

Future investigators can make intentional changes through the application; the digest records preservation during this implementation, not a promise that an actively used database will remain frozen. Test data and database files are not committed; only the original synthetic SQL snapshot and its digest are versioned.
