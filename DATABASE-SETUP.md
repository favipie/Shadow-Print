# Database setup status

Phase 3 provides a MySQL 8.0.16+ reference schema, deterministic seed, detection views/procedures and integration verifier in `database/`. Follow [database/README.md](database/README.md) only with a dedicated non-production MySQL schema. The source MySQL implementation has not passed live-engine verification in this workspace because no MySQL service was available.

SQL Server Express is the planned local continuation target. `database/sqlserver/` intentionally contains no untested conversion. Do not run the MySQL files in SQL Server Management Studio. First convert and test a T-SQL migration/seed series, then record the actual server version, migration output, seed counts, query-plan evidence and integration test output in the Phase 3 report.

Keep connection data in a local ignored `.env` file. `database/.env.example` contains placeholders only. Never publish `.mdf`, `.ldf`, `.bak`, password, token or connection string files.
