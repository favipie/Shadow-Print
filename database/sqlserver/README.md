# SQL Server implementation

This directory contains a read-only export of the existing, verified Microsoft SQL Server 2025 database. It is the active schema contract used by FastAPI. The original MySQL implementation in the parent directory is historical reference.

- `001_schema.sql`: 22 tables, original types/collations, identity columns, defaults, keys, checks, foreign keys and indexes.
- `002_detection.sql`: seven views, three procedures and the existing normalization function, retaining the verified SQL detection rules.
- `003_seed.sql`: 236 original synthetic rows, including 9 accounts, 28 comments, 11 findings and existing investigation history.
- `baseline.json`: sorted row counts and SHA-256 hashes for all 22 tables, captured before integration tests.
- [VALIDATION.md](VALIDATION.md): executed SQL Server validation and preservation evidence.

The scripts initialize **empty disposable test databases only** through `backend/migrate.py`. Never apply them to the populated `shadowprint_db`. The runner requires a database name ending in `_test` and refuses nonempty databases. The application does not run migrations at startup.

`backend/export_sqlserver.py` reads catalog definitions and records without changing the source database. Its `--digest-only` option writes table hashes for comparison. Configure the instance using ignored environment settings; no credentials or database backups are committed.

See [database setup](../../DATABASE-SETUP.md), [backend](../../backend/README.md), and [integration verification](../../INTEGRATION-VERIFICATION.md).
