# Local examiner demonstration

Allow 8–10 minutes. Use the existing local application; no internet hosting is needed. Do not rerun migrations on shadowprint_db. A live review/case save changes the demo database, so explain this before saving. Use the isolated browser test for a fully repeatable modifying demonstration.

1. **Architecture (one minute).** Show README and explain Next.js → FastAPI → SQL Server. Start the two services using scripts/start-local.ps1. Open http://127.0.0.1:3000 and http://127.0.0.1:8000/docs. Explain Windows Authentication and why SQL credentials are absent from the browser.
2. **Database (two minutes).** In SSMS connect to favipie\SQLEXPRESS using Windows Authentication, select shadowprint_db, and show the 22 tables. Run the read-only queries below. Explain primary/foreign keys, evidence's exact-one-source CHECK and the case-evidence junction.
3. **Investigation (two minutes).** Search the threat queue for C-352, open its original text/provenance, investigate A-003 and show its baseline score of 50. Follow the account into the network and inspect supporting records. A signal is a reason to review, not proof of identity.
4. **Negative control (one minute).** Inspect A-007 and A-008 and their shared-device context. Both baseline scores are zero. Explain why a library terminal can be shared harmlessly.
5. **Persistence (two minutes).** For a modifying demo, create a clearly titled examiner case, attach evidence, add a note and reload. Mark a comment reviewed and reload. Show the audit trail and a report. Otherwise show the passing isolated browser test and existing cases. Do not imply the browser's local storage is the persistence layer.
6. **SQL and limits (two minutes).** Show a sliding-window view, the 90/91-second test, TRY/CATCH rollback handling and the original academic query file. Explain distinct annotation/finding counts and the absence of real-world accuracy measurements.

## Read-only SSMS queries

```sql
USE shadowprint_db;
SELECT DB_NAME() AS database_name, @@VERSION AS engine_version;
SELECT COUNT(*) AS user_tables FROM sys.tables WHERE is_ms_shipped=0;
SELECT (SELECT COUNT(*) FROM dbo.accounts) AS accounts,
       (SELECT COUNT(*) FROM dbo.comments) AS comments,
       (SELECT COUNT(*) FROM dbo.comment_labels) AS annotation_rows;
SELECT * FROM dbo.v_account_scores ORDER BY id;
SELECT TOP (10) c.id, a.handle, p.name AS provenance, c.body
FROM dbo.comments c
JOIN dbo.accounts a ON a.id=c.author_id
JOIN dbo.provenance p ON p.id=c.provenance_id
ORDER BY c.created_at,c.id;
SELECT a.account_id AS account_one,b.account_id AS account_two,a.device_id
FROM dbo.login_events a JOIN dbo.login_events b
  ON a.device_id=b.device_id AND a.account_id<b.account_id;
```

## Recovery and evidence

If the UI reports an API error, verify FastAPI at port 8000, SQL Server Express and ODBC Driver 18. Do not switch to fixtures to conceal a connection failure. If a save times out, refresh before repeating it. Do not run 006_verify.sql or the transaction example on the main database during a read-only presentation: they contain writes, even when rolled back.

Automated modifying demonstration: run scripts/test-e2e.ps1 from the repository root. It starts isolated services on 13000/18000 and creates/removes only its owned disposable test database. Previous screenshots and printed report are ignored QA artifacts, not claims of current live execution.
