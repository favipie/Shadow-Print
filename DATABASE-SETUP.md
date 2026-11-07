# SQL Server database setup

The active database is `favipie\SQLEXPRESS` / `shadowprint_db`, SQL Server 2025 Express with Windows Authentication and ODBC Driver 18. It is populated: **do not migrate, reseed, reset or drop it**. Startup never changes the schema.

Read-only connectivity from a normal local terminal:

```powershell
sqlcmd -S 'favipie\SQLEXPRESS' -E -C -d shadowprint_db -Q "SELECT DB_NAME(); SELECT @@VERSION; SELECT COUNT(*) AS tables FROM sys.tables WHERE is_ms_shipped=0;"
```

The verified four-file schema/views/procedures/seed sequence is described in [SQL Server README](database/sqlserver/README.md). The original MySQL implementation is historical reference, not the active database. The recovery catalog digest is retained as historical evidence; it is not a replacement seed.

## Disposable tests

Backend integration tests require `SHADOWPRINT_RUN_DB_TESTS=1`. They create random `shadowprint_test_<32 hex>` databases, record ownership under ignored `backend/.test-output`, install the verified schema and original seed, run detection/tests, and clean up only owned databases. The canonical, legacy and synthetic workload suites use these fixtures. `backend/migrate.py` also requires ownership and an empty database and never accepts `shadowprint_db`.

The browser wrapper `scripts/test-e2e.ps1` creates its own database, passes an ephemeral service key and database URL to isolated services, then removes the database. No externally supplied test database URL is trusted as permission to write. A failed/interrupted test may leave an ownership marker; inspect it before using `backend/testing.py drop <exact-owned-name>`.

Connection URLs and service keys belong only in ignored environment files. See [Windows setup](SETUP-WINDOWS.md), [backend contracts](backend/README.md) and [current verification](FINAL-INTEGRATION.md).
