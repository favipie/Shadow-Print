# SQL Server database setup

The active database is Microsoft SQL Server 2025 Express with Windows Authentication and Microsoft ODBC Driver 18. FastAPI uses SQLAlchemy's `mssql+pyodbc` dialect. MySQL scripts under `database/` are historical reference only.

## Existing application database

Do not migrate, reseed, drop, reset or replace `shadowprint_db`. Configure the backend to use it through the ignored `backend/.env`. The application never creates schema at startup. Before changing configuration, a read-only check can use:

```powershell
sqlcmd -S 'localhost\SQLEXPRESS' -E -C -d shadowprint_db -Q "SELECT DB_NAME(); SELECT COUNT(*) AS tables FROM sys.tables; SELECT COUNT(*) AS accounts FROM dbo.accounts; SELECT COUNT(*) AS comments FROM dbo.comments; SELECT COUNT(*) AS findings FROM dbo.findings;"
```

The verified baseline is 22 tables, 9 accounts, 28 comments and 11 findings. See [validation](database/sqlserver/VALIDATION.md). The read-only exporter `backend/export_sqlserver.py` captures the existing catalog, constraints, indexes, views, function, procedures and synthetic records; it does not derive a replacement ORM schema.

## Disposable integration database only

Choose a new test database ending in `_test`. This example uses Windows Authentication:

```powershell
sqlcmd -S 'localhost\SQLEXPRESS' -E -C -d master -b -Q "CREATE DATABASE shadowprint_api_test;"
cd backend
$env:SHADOWPRINT_DATABASE_URL = 'mssql+pyodbc://localhost\SQLEXPRESS/shadowprint_api_test?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&LongAsMax=yes'
uv run python migrate.py
$env:SHADOWPRINT_TEST_DATABASE_URL = $env:SHADOWPRINT_DATABASE_URL
uv run pytest -q
Remove-Item Env:SHADOWPRINT_DATABASE_URL
```

`migrate.py` refuses any database whose name does not end in `_test`, and refuses nonempty databases. It never creates/deletes a database or drops tables. Test records and audit history are retained in the disposable database. Do not remove or bypass these guards to initialize the application database.

The checked-in SQL Server seed is a snapshot of the existing synthetic records, including the previously verified detection findings and review/audit history. Tests add their own uniquely identified cases and runs without overwriting the baseline.

Connection strings and service keys belong only in ignored environment files. `TrustServerCertificate=yes` is used for the local Express instance; choose validated certificates for a remotely administered deployment. Production user authentication, authorization and deployment are outside this local integration.
