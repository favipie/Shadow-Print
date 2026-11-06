# SQL Server migration — verified locally

The original MySQL implementation under `database/` is preserved. After user approval on 2 November 2026, these scripts created 22 tables and passed live integration verification on SQL Server 2025 Express. The original seed counts, 11 findings and expected scores were confirmed. See [VALIDATION.md](VALIDATION.md) for actual results. Checkpoint tag: `checkpoint-before-sqlserver-migration-20261102` at `797df501019c01959971b625ba36ea2a182faa77`.

The approved target is `favipie\SQLEXPRESS`, database `shadowprint_db`, using Windows Authentication. The migration wrapper deliberately checks that exact target. Other machines require a reviewed change to the target guard as well as the connection command. No credentials are stored in these files.

## Files and execution order

1. `001_schema.sql`: 22 tables, PKs/FKs, CHECKs, unique constraints and indexes.
2. `002_views.sql`: Unicode text normalizer and seven detection/review views.
3. `003_procedures.sql`: run_detection, review_comment, change_case_status.
4. `004_seed.sql`: exact original IDs, text, times, annotations and associations. Expected 9 accounts, 28 comments, 25 annotations, 6 devices, 8 logins and 3 investigations.
5. `006_verify.sql`: actual engine tests for counts, scores, 11 findings, exact evidence associations, 90/91-second coordination boundaries, FK/CHECK/unique rejection, duplicate-run rollback, late audit failure rollback, review persistence and case decisions.
6. `005_academic_queries.sql`: joins, self-joins, GROUP BY/HAVING, subqueries, CTEs, recursive traversal, window functions, views and a rollback transaction. Enable SSMS actual execution plans to inspect the indexed range query; no performance claim is made.

`migrate.sql` executes the files in this order. The schema/views/procedures/seed are inside one outer transaction. SQLCMD aborts on errors and disconnects, rolling back an uncommitted migration. No databases or objects are dropped. The wrapper checks the exact approved target, zero tables and no existing views/procedures/functions. It also sets the session options required for filtered indexes. Procedure calls own their transactions and reject an existing caller transaction.

Verification runs after the migration commits. A verification failure leaves the installed schema for diagnosis; do not rerun migration over a populated database. Tests retain a uniquely named detection run and four audit events; review state is restored to unreviewed and the library case to Open. Case updated_at and audit history reflect verification activity. Boundary mutations roll back. Do not use these tests on real user casework.

## Migration command — empty database only

This command has already been executed on the approved local database. The database now contains tables, so the wrapper will refuse a second migration. Retained here for reproducibility on an approved empty target, from the repository root:

```powershell
Push-Location database/sqlserver
try {
  sqlcmd -S 'favipie\SQLEXPRESS' -d shadowprint_db -E -C -b -r 1 -f 65001 -i migrate.sql
  if ($LASTEXITCODE -ne 0) { throw 'Migration or verification failed' }
} finally { Pop-Location }
```

`-E` uses Windows Authentication; `-C` trusts the local development certificate, matching the verified local connection. No password is used. In SSMS connect with Windows Authentication, select shadowprint_db, enable Query → SQLCMD Mode and open migrate.sql. Resolve each `:r` include to an absolute path if SSMS's working directory differs. Keep `:ON ERROR EXIT` and execute the whole wrapper after approval.

## Conversion decisions and limits

ENUM becomes NVARCHAR plus CHECK; text is Unicode NVARCHAR(MAX); dates are UTC DATETIME2(3); identity columns use BIGINT IDENTITY; JSON uses NVARCHAR(MAX) with ISJSON checks. Evidence source uniqueness uses three filtered unique indexes because SQL Server ordinary UNIQUE semantics for NULL differ from MySQL. Foreign keys retain restrictive deletes.

Inclusive BETWEEN/DATEADD windows preserve the rules. Expected scores are A-001=30, A-002=55, A-003=50, A-004=25, A-006=25; all others zero. Shared devices do not enter scoring. All evidence links reference original comments. Detection snapshots matched evidence once for consistent findings and associations.

Native regex on SQL Server 2025 RTM cannot accept MAX input. A scalar Unicode whitespace normalizer preserves long comment content without truncation. It uses binary normalized-text comparison and SQL Server Latin1_General_100 case folding; non-demo Unicode case equivalence and larger workload performance need dedicated testing. Finding hashes use UTF-16 input and can differ from MySQL hashes; these are new derived run IDs, not replaced source IDs. Audit capture is procedural; production grants/immutability remain backend work.

## Offline checks

```powershell
node database/sqlserver/convert.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File database/sqlserver/validate.ps1
node node_modules/tsx/dist/cli.mjs --test database/sqlserver/artifacts.test.ts
```

The converter regenerates schema/views/seed/academic SQL from unchanged MySQL sources. Procedures and integration tests are handwritten. validate.ps1 uses the installed Microsoft ScriptDom TSql170Parser without a database connection. The execution-policy option applies only to that PowerShell process; it does not change machine policy. Parsing is syntax validation only; object binding, transactions and detection results require approved engine execution. See VALIDATION.md for executed results.

No SQL Server credentials, connection strings, backup files or local-machine settings belong in Git.
