CREATE PROCEDURE dbo.run_detection @p_run NVARCHAR(64)
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
CREATE PROCEDURE dbo.review_comment @p_comment NVARCHAR(64),@p_actor NVARCHAR(64),@p_reviewed INT,@p_reason NVARCHAR(MAX)
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
CREATE PROCEDURE dbo.change_case_status @p_case NVARCHAR(64),@p_actor NVARCHAR(64),@p_status NVARCHAR(64),@p_decision NVARCHAR(MAX)
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
