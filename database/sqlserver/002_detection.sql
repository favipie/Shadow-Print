CREATE OR ALTER FUNCTION dbo.normalize_comment(@body NVARCHAR(MAX)) RETURNS NVARCHAR(MAX) AS
BEGIN
 DECLARE @result NVARCHAR(MAX)=N'',@i INT=1,@n INT=LEN(@body+N'#')-1,@cp INT,@space BIT=0,@ch NVARCHAR(2);
 WHILE @i<=@n
 BEGIN
 SET @ch=SUBSTRING(@body,@i,1); SET @cp=UNICODE(@ch);
 IF @cp BETWEEN 9 AND 13 OR @cp IN (32,133,160,5760,8232,8233,8239,8287,12288) OR @cp BETWEEN 8192 AND 8202
 BEGIN IF LEN(@result)>0 SET @space=1; END
 ELSE BEGIN IF @space=1 SET @result+=N' '; SET @result+=@ch; SET @space=0; END;
 SET @i+=1;
 END;
 RETURN LOWER(@result COLLATE Latin1_General_100_CI_AS_SC);
END;

GO
-- Explainable sliding windows. Labels are supplied annotations, never NLP predictions.
CREATE VIEW dbo.v_normalized_comments AS
SELECT c.*, dbo.normalize_comment(body) COLLATE Latin1_General_100_BIN2 AS normalized_body
FROM dbo.comments c;

GO
CREATE OR ALTER VIEW dbo.v_duplicate_windows AS
SELECT a.id AS anchor_id,a.author_id,COUNT(*) AS match_count
FROM dbo.v_normalized_comments a JOIN dbo.v_normalized_comments b
 ON b.author_id=a.author_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,1800,a.created_at)
GROUP BY a.id,a.author_id HAVING COUNT(*)>=5;

GO
CREATE OR ALTER VIEW dbo.v_targeting_windows AS
SELECT a.id AS anchor_id,a.author_id,a.target_id,COUNT(*) AS match_count
FROM dbo.comments a JOIN dbo.comments b ON b.author_id=a.author_id AND b.target_id=a.target_id
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,86400,a.created_at)
WHERE EXISTS (SELECT 1 FROM dbo.comment_labels l WHERE l.comment_id=b.id AND l.label_code='Repeated harassment')
GROUP BY a.id,a.author_id,a.target_id HAVING COUNT(*)>=6;

GO
CREATE OR ALTER VIEW dbo.v_coordination_windows AS
SELECT a.id AS anchor_id,a.target_id,COUNT(DISTINCT b.author_id) AS account_count
FROM dbo.v_normalized_comments a JOIN dbo.v_normalized_comments b
 ON b.target_id=a.target_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,90,a.created_at)
GROUP BY a.id,a.target_id HAVING COUNT(DISTINCT b.author_id)>=3;

GO
-- One row per evidence comment. Multiple qualifying windows are retained explicitly.
CREATE VIEW dbo.v_detection_evidence AS
SELECT 'REP-01' AS rule_code,w.anchor_id,b.author_id AS account_id,b.id AS comment_id
FROM dbo.v_duplicate_windows w JOIN dbo.v_normalized_comments a ON a.id=w.anchor_id
JOIN dbo.v_normalized_comments b ON b.author_id=a.author_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,1800,a.created_at)
UNION ALL
SELECT 'TARGET-01',w.anchor_id,b.author_id,b.id FROM dbo.v_targeting_windows w
JOIN dbo.comments a ON a.id=w.anchor_id JOIN dbo.comments b ON b.author_id=a.author_id AND b.target_id=a.target_id
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,86400,a.created_at)
WHERE EXISTS(SELECT 1 FROM dbo.comment_labels l WHERE l.comment_id=b.id AND l.label_code='Repeated harassment')
UNION ALL
SELECT 'COORD-01',w.anchor_id,participant.author_id,b.id
FROM dbo.v_coordination_windows w JOIN dbo.v_normalized_comments a ON a.id=w.anchor_id
JOIN dbo.v_normalized_comments participant ON participant.target_id=a.target_id AND participant.normalized_body=a.normalized_body
 AND participant.created_at BETWEEN a.created_at AND DATEADD(SECOND,90,a.created_at)
JOIN dbo.v_normalized_comments b ON b.target_id=a.target_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,90,a.created_at)
UNION ALL
SELECT 'THREAT-01',c.id,c.author_id,c.id FROM dbo.comments c
WHERE EXISTS(SELECT 1 FROM dbo.comment_labels l WHERE l.comment_id=c.id AND l.label_code='Threat-related language');

GO
CREATE OR ALTER VIEW dbo.v_account_scores AS
SELECT a.id,COALESCE(SUM(r.weight),0) AS demo_score
FROM dbo.accounts a LEFT JOIN (SELECT DISTINCT account_id,rule_code FROM dbo.v_detection_evidence) d ON d.account_id=a.id
LEFT JOIN dbo.detection_rules r ON r.code=d.rule_code AND r.version=1 GROUP BY a.id;

GO
CREATE OR ALTER VIEW dbo.v_latest_reviews AS
SELECT id,comment_id,investigator_id,reviewed,reason,occurred_at FROM
(SELECT r.*,ROW_NUMBER() OVER(PARTITION BY comment_id ORDER BY occurred_at DESC,id DESC) AS rn FROM dbo.review_actions r) ranked WHERE rn=1;

GO
CREATE OR ALTER PROCEDURE dbo.run_detection @p_run NVARCHAR(64)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @@TRANCOUNT<>0 THROW 51000,'Call outside an existing transaction',1;
 BEGIN TRY
 BEGIN TRANSACTION;
 -- Snapshot evidence once so findings and associations use the same source set.
 SELECT DISTINCT * INTO #matches FROM dbo.v_detection_evidence;
 INSERT INTO dbo.detection_runs VALUES(@p_run,SYSUTCDATETIME(),'tsql-v1','Review signals; shared devices excluded');
 INSERT INTO dbo.evidence(id,comment_id)
 SELECT CONCAT('E-',c.id),c.id FROM dbo.comments c WHERE NOT EXISTS(SELECT 1 FROM dbo.evidence e WHERE e.comment_id=c.id);
 INSERT INTO dbo.findings(id,run_id,rule_code,rule_version,account_id,anchor_comment_id,explanation)
 SELECT LOWER(CONVERT(VARCHAR(64),HASHBYTES('SHA2_256',CONCAT(@p_run,'|',d.rule_code,'|',d.account_id,'|',d.anchor_id)),2)),
 @p_run,d.rule_code,1,d.account_id,d.anchor_id,
 CONCAT('SQL v1 ',d.rule_code,': ',COUNT(DISTINCT d.comment_id),' original evidence comments. Review context; not proof of intent or identity.')
 FROM #matches d GROUP BY d.rule_code,d.account_id,d.anchor_id;
 INSERT INTO dbo.finding_evidence
 SELECT DISTINCT f.id,e.id FROM dbo.findings f JOIN #matches d
 ON d.rule_code=f.rule_code AND d.account_id=f.account_id AND d.anchor_id=f.anchor_comment_id
 JOIN dbo.evidence e ON e.comment_id=d.comment_id WHERE f.run_id=@p_run;
 COMMIT;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
 END CATCH;
END;

GO
CREATE OR ALTER PROCEDURE dbo.review_comment @p_comment NVARCHAR(64),@p_actor NVARCHAR(64),@p_reviewed INT,@p_reason NVARCHAR(MAX)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @@TRANCOUNT<>0 THROW 51000,'Call outside an existing transaction',1;
 IF @p_reviewed IS NULL OR @p_reviewed NOT IN(0,1) THROW 51000,'Review must be 0 or 1',1;
 BEGIN TRY
 BEGIN TRANSACTION;
 INSERT INTO dbo.review_actions(comment_id,investigator_id,reviewed,reason,occurred_at)
 VALUES(@p_comment,@p_actor,@p_reviewed,@p_reason,SYSUTCDATETIME());
 DECLARE @id BIGINT=CONVERT(BIGINT,SCOPE_IDENTITY());
 INSERT INTO dbo.audit_history(investigator_id,review_action_id,action,new_value,occurred_at)
 VALUES(@p_actor,@id,'comment_review',(SELECT @p_reviewed AS reviewed,@p_reason AS reason FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),SYSUTCDATETIME());
 COMMIT;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
 END CATCH;
END;

GO
CREATE OR ALTER PROCEDURE dbo.change_case_status @p_case NVARCHAR(64),@p_actor NVARCHAR(64),@p_status NVARCHAR(64),@p_decision NVARCHAR(MAX)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @@TRANCOUNT<>0 THROW 51000,'Call outside an existing transaction',1;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @old NVARCHAR(64);
 SELECT @old=status FROM dbo.investigations WITH(UPDLOCK,HOLDLOCK) WHERE id=@p_case;
 IF @old IS NULL THROW 51000,'Unknown investigation',1;
 UPDATE dbo.investigations SET status=@p_status,decision=@p_decision,updated_at=SYSUTCDATETIME() WHERE id=@p_case;
 INSERT INTO dbo.audit_history(investigator_id,investigation_id,action,old_value,new_value,occurred_at)
 VALUES(@p_actor,@p_case,'case_status',(SELECT @old AS status FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
 (SELECT @p_status AS status,@p_decision AS decision FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),SYSUTCDATETIME());
 COMMIT;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
 END CATCH;
END;

GO
