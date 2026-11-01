# SQL Server implementation placeholder

The current Phase 3 database is MySQL 8.0.16+ reference code under `database/`. It has not been imported into SQL Server and must not be executed unchanged against SQL Server Express.

The intended local target is configured by environment, not hard-coded project configuration. On the project owner's laptop, the known target is a Windows-authenticated SQL Server Express instance and `shadowprint_db`. Other machines must supply their own server/database values.

Before conversion, create a separate SQL Server migration series that maps MySQL `ENUM`, `DATETIME(3)`, `JSON`, procedures, check constraints, `REGEXP_REPLACE`, views and recursive CTE syntax to tested T-SQL equivalents. Preserve the 9-account/28-comment deterministic scenario and its known positive and benign controls. Run the converted schema, seed and tests against SQL Server before connecting FastAPI or the frontend.

No SQL Server credentials, connection strings, backup files or local-machine settings belong in Git.
