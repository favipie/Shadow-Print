-- 1. JOIN: source-backed evidence with readable participants.
SELECT c.id,a.handle AS author,t.handle AS target,c.body,p.name AS provenance
FROM comments c JOIN accounts a ON a.id=c.author_id JOIN accounts t ON t.id=c.target_id
JOIN provenance p ON p.id=c.provenance_id ORDER BY c.created_at,c.id;
-- 2. Self-join: shared-device context, not an identity or scoring query.
SELECT DISTINCT a.account_id,b.account_id,a.device_id FROM login_events a
JOIN login_events b ON b.device_id=a.device_id AND a.account_id<b.account_id;
-- 3. GROUP BY/HAVING: descriptive volume, not detection by itself.
SELECT author_id,COUNT(*) AS comments FROM comments GROUP BY author_id HAVING COUNT(*)>=5;
-- 4. Correlated subquery: accounts with no current detection evidence.
SELECT a.id FROM accounts a WHERE NOT EXISTS(SELECT 1 FROM v_detection_evidence d WHERE d.account_id=a.id);
-- 5. CTE: exact demo activity totals.
WITH totals AS (SELECT author_id,COUNT(*) AS n FROM comments GROUP BY author_id)
SELECT a.handle,COALESCE(t.n,0) AS comment_count FROM accounts a LEFT JOIN totals t ON t.author_id=a.id;
-- 6. Recursive CTE: directed reply reachability; cycle guard and depth cap.
-- Describes interaction paths only, never shared identity.
WITH edges AS (SELECT DISTINCT author_id,target_id FROM comments),
walk AS (
 SELECT CAST(N'A-001' AS NVARCHAR(64)) AS account_id,CAST(N'|A-001|' AS NVARCHAR(2048)) AS path,0 AS depth
 UNION ALL
 SELECT e.target_id,CAST(CONCAT(w.path,e.target_id,'|') AS NVARCHAR(2048)),w.depth+1 FROM walk w
 JOIN edges e ON e.author_id=w.account_id
 WHERE w.depth<8 AND CHARINDEX(CONCAT('|',e.target_id,'|'),w.path)=0
) SELECT * FROM walk OPTION (MAXRECURSION 8);
-- 7. Window functions: order and gaps, with deterministic tie-breaker.
SELECT id,author_id,created_at,ROW_NUMBER() OVER(PARTITION BY author_id ORDER BY created_at,id) AS ordinal,
DATEDIFF(SECOND,LAG(created_at) OVER(PARTITION BY author_id ORDER BY created_at,id),created_at) AS gap_seconds FROM comments;
-- 8. Views: expected demo scores A-001=30,A-002=55,A-003=50,A-004=25,A-006=25; others=0.
SELECT * FROM v_account_scores ORDER BY id;
-- 9. Query planning: inspect indexes; no performance claim without measurements.
SELECT * FROM comments WHERE author_id='A-004' AND created_at>='2026-10-17' AND created_at<'2026-10-18';
-- 10. Explicit reversible transaction demonstration (no durable mutation).
BEGIN TRANSACTION;
SELECT status FROM investigations WHERE id='SP-0098';
UPDATE investigations SET status='Under review' WHERE id='SP-0098';
ROLLBACK;
-- Stored procedures are exercised by 006_verify.sql: run_detection, review_comment, change_case_status.
