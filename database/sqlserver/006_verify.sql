SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'shadowprint_db' THROW 51000,'Wrong database',1;
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>22 THROW 51000,'Expected 22 tables',1;
IF (SELECT COUNT(*) FROM dbo.accounts)<>9 OR (SELECT COUNT(*) FROM dbo.comments)<>28
 OR (SELECT COUNT(*) FROM dbo.comment_labels)<>25 OR (SELECT COUNT(*) FROM dbo.devices)<>6
 OR (SELECT COUNT(*) FROM dbo.login_events)<>8 OR (SELECT COUNT(*) FROM dbo.investigations)<>3
 THROW 51000,'Seed counts failed',1;
IF EXISTS(SELECT * FROM dbo.v_account_scores EXCEPT SELECT * FROM (VALUES
 (N'A-001',30),(N'A-002',55),(N'A-003',50),(N'A-004',25),(N'A-005',0),(N'A-006',25),(N'A-007',0),(N'A-008',0),(N'U-021',0)) v(id,score))
 THROW 51000,'Scores differ',1;
IF (SELECT COUNT(*) FROM dbo.v_coordination_windows)<>1 OR NOT EXISTS(SELECT 1 FROM dbo.v_coordination_windows WHERE anchor_id='C-410' AND account_count=3)
 THROW 51000,'Coordination baseline failed',1;
-- Boundary changes are always rolled back, even when an assertion fails.
BEGIN TRY
 BEGIN TRANSACTION;
 UPDATE dbo.comments SET created_at='2026-10-18T14:32:35' WHERE id='C-412';
 IF NOT EXISTS(SELECT 1 FROM dbo.v_coordination_windows WHERE anchor_id='C-410') THROW 51000,'90 seconds must qualify',1;
 UPDATE dbo.comments SET created_at='2026-10-18T14:32:36' WHERE id='C-412';
 IF EXISTS(SELECT 1 FROM dbo.v_coordination_windows) THROW 51000,'91 seconds must not qualify',1;
 ROLLBACK;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
-- Real engine rejection tests: FK, exact-one source, uniqueness, closed-case decision.
BEGIN TRY
 BEGIN TRANSACTION;
 UPDATE dbo.comments SET created_at='2026-10-09T16:00:00' WHERE id='C-295';
 UPDATE dbo.comments SET created_at='2026-10-08T16:30:00' WHERE id='C-294';
 IF NOT EXISTS(SELECT 1 FROM dbo.v_duplicate_windows WHERE anchor_id='C-290') THROW 51000,'30-minute boundary must qualify',1;
 UPDATE dbo.comments SET created_at='2026-10-08T16:30:00.001' WHERE id='C-294';
 IF EXISTS(SELECT 1 FROM dbo.v_duplicate_windows WHERE anchor_id='C-290') THROW 51000,'Beyond 30-minute boundary must fail',1;
 UPDATE dbo.comments SET created_at='2026-10-19T08:18:00' WHERE id='C-395';
 IF NOT EXISTS(SELECT 1 FROM dbo.v_targeting_windows WHERE anchor_id='C-390') THROW 51000,'24-hour boundary must qualify',1;
 UPDATE dbo.comments SET created_at='2026-10-19T08:18:00.001' WHERE id='C-395';
 IF EXISTS(SELECT 1 FROM dbo.v_targeting_windows WHERE anchor_id='C-390') THROW 51000,'Beyond 24-hour boundary must fail',1;
 ROLLBACK;
END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH;
IF dbo.normalize_comment(N' A'+NCHAR(9)+NCHAR(160)+N'B ')<>N'a b' THROW 51000,'Whitespace normalization failed',1;
IF LEN(dbo.normalize_comment(REPLICATE(CONVERT(NVARCHAR(MAX),N'X'),5000)))<>5000 THROW 51000,'Normalizer truncated content',1;
DECLARE @rejected BIT=0;
BEGIN TRY
 BEGIN TRANSACTION;
 UPDATE dbo.comments SET author_id='missing' WHERE id='C-501';
 ROLLBACK;
END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; IF ERROR_NUMBER()<>547 THROW; SET @rejected=1; END CATCH;
IF @rejected=0 THROW 51000,'Foreign key accepted invalid author',1;
SET @rejected=0;
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT INTO dbo.evidence(id) VALUES('INVALID');
 ROLLBACK;
END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; IF ERROR_NUMBER()<>547 THROW; SET @rejected=1; END CATCH;
IF @rejected=0 THROW 51000,'Evidence CHECK failed',1;
SET @rejected=0;
BEGIN TRY
 BEGIN TRANSACTION;
 INSERT INTO dbo.evidence(id,comment_id) VALUES('INVALID','C-501');
 ROLLBACK;
END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; IF ERROR_NUMBER() NOT IN(2601,2627) THROW; SET @rejected=1; END CATCH;
IF @rejected=0 THROW 51000,'Evidence uniqueness failed',1;
DECLARE @run NVARCHAR(64)=CONCAT('verify-',CONVERT(NVARCHAR(36),NEWID()));
EXEC dbo.run_detection @run;
IF (SELECT COUNT(*) FROM dbo.findings WHERE run_id=@run)<>11 THROW 51000,'Expected 11 findings',1;
-- Exact association equality, both directions, not merely nonempty evidence.
IF EXISTS(SELECT f.rule_code,f.account_id,f.anchor_comment_id,e.comment_id FROM dbo.findings f
 JOIN dbo.finding_evidence fe ON fe.finding_id=f.id JOIN dbo.evidence e ON e.id=fe.evidence_id WHERE f.run_id=@run
 EXCEPT SELECT rule_code,account_id,anchor_id,comment_id FROM dbo.v_detection_evidence)
 OR EXISTS(SELECT rule_code,account_id,anchor_id,comment_id FROM dbo.v_detection_evidence EXCEPT
 SELECT f.rule_code,f.account_id,f.anchor_comment_id,e.comment_id FROM dbo.findings f
 JOIN dbo.finding_evidence fe ON fe.finding_id=f.id JOIN dbo.evidence e ON e.id=fe.evidence_id WHERE f.run_id=@run)
 THROW 51000,'Evidence association mismatch',1;
SET @rejected=0;
BEGIN TRY EXEC dbo.run_detection @run; END TRY
BEGIN CATCH IF ERROR_NUMBER() NOT IN(2601,2627) THROW; SET @rejected=1; END CATCH;
IF @rejected=0 OR @@TRANCOUNT<>0 OR (SELECT COUNT(*) FROM dbo.findings WHERE run_id=@run)<>11 THROW 51000,'Duplicate run rollback failed',1;
DECLARE @audits BIGINT=(SELECT COUNT_BIG(*) FROM dbo.audit_history);
SET @rejected=0;
BEGIN TRY EXEC dbo.change_case_status 'SP-0098','DEMO-ANALYST','Closed',''; END TRY
BEGIN CATCH IF ERROR_NUMBER()<>547 THROW; SET @rejected=1; END CATCH;
IF @rejected=0 OR (SELECT COUNT_BIG(*) FROM dbo.audit_history)<>@audits OR @@TRANCOUNT<>0 THROW 51000,'Invalid closure rollback failed',1;
-- Fail late at the audit FK: earlier case update must also roll back.
SET @rejected=0;
BEGIN TRY EXEC dbo.change_case_status 'SP-0098','missing','Closed','Test decision'; END TRY
BEGIN CATCH IF ERROR_NUMBER()<>547 THROW; SET @rejected=1; END CATCH;
IF @rejected=0 OR (SELECT status FROM dbo.investigations WHERE id='SP-0098')<>'Open' THROW 51000,'Late audit failure did not roll back case',1;
EXEC dbo.change_case_status 'SP-0098','DEMO-ANALYST','Closed','Benign shared-device control';
EXEC dbo.change_case_status 'SP-0098','DEMO-ANALYST','Open','';
EXEC dbo.review_comment 'C-501','DEMO-ANALYST',1,'Integration review';
IF (SELECT reviewed FROM dbo.v_latest_reviews WHERE comment_id='C-501')<>1 THROW 51000,'Review save failed',1;
EXEC dbo.review_comment 'C-501','DEMO-ANALYST',0,'Integration restore';
IF (SELECT reviewed FROM dbo.v_latest_reviews WHERE comment_id='C-501')<>0 OR (SELECT COUNT_BIG(*) FROM dbo.audit_history)<>@audits+4 THROW 51000,'Review/audit count failed',1;
SELECT f.rule_code,f.account_id,c.id,c.body,c.created_at FROM dbo.findings f
 JOIN dbo.finding_evidence fe ON fe.finding_id=f.id JOIN dbo.evidence e ON e.id=fe.evidence_id
 JOIN dbo.comments c ON c.id=e.comment_id WHERE f.run_id=@run ORDER BY f.rule_code,f.account_id,c.id;
SELECT * FROM dbo.v_account_scores ORDER BY id;
SELECT @run AS verified_run,'PASS: engine verification' AS result;
GO
