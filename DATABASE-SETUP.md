# Database setup status

Phase 3 provides a MySQL 8.0.16+ reference schema, deterministic seed, detection views/procedures and integration verifier in `database/`. Follow [database/README.md](database/README.md) only with a dedicated non-production MySQL schema. The source MySQL implementation has not passed live-engine verification in this workspace because no MySQL service was available.

SQL Server migration and live integration verification passed on 2 November 2026 against the approved local `shadowprint_db`: 22 tables, original seed counts, 11 findings and expected scores. See [the execution report](database/sqlserver/VALIDATION.md) and [SQLCMD/SSMS instructions](database/sqlserver/README.md). The database is now populated; do not rerun the empty-database migration. Do not run MySQL reference scripts in SQL Server Management Studio.

Keep connection data in a local ignored `.env` file. `database/.env.example` contains placeholders only. Never publish `.mdf`, `.ldf`, `.bak`, password, token or connection string files.
