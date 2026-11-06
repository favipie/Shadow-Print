CREATE FUNCTION dbo.normalize_comment(@body NVARCHAR(MAX)) RETURNS NVARCHAR(MAX) AS
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
CREATE VIEW dbo.v_duplicate_windows AS
SELECT a.id AS anchor_id,a.author_id,COUNT(*) AS match_count
FROM dbo.v_normalized_comments a JOIN dbo.v_normalized_comments b
 ON b.author_id=a.author_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,1800,a.created_at)
GROUP BY a.id,a.author_id HAVING COUNT(*)>=5;
GO
CREATE VIEW dbo.v_targeting_windows AS
SELECT a.id AS anchor_id,a.author_id,a.target_id,COUNT(*) AS match_count
FROM dbo.comments a JOIN dbo.comments b ON b.author_id=a.author_id AND b.target_id=a.target_id
 AND b.created_at BETWEEN a.created_at AND DATEADD(SECOND,86400,a.created_at)
WHERE EXISTS (SELECT 1 FROM dbo.comment_labels l WHERE l.comment_id=b.id AND l.label_code='Repeated harassment')
GROUP BY a.id,a.author_id,a.target_id HAVING COUNT(*)>=6;
GO
CREATE VIEW dbo.v_coordination_windows AS
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
CREATE VIEW dbo.v_account_scores AS
SELECT a.id,COALESCE(SUM(r.weight),0) AS demo_score
FROM dbo.accounts a LEFT JOIN (SELECT DISTINCT account_id,rule_code FROM dbo.v_detection_evidence) d ON d.account_id=a.id
LEFT JOIN dbo.detection_rules r ON r.code=d.rule_code AND r.version=1 GROUP BY a.id;
GO
CREATE VIEW dbo.v_latest_reviews AS
SELECT id,comment_id,investigator_id,reviewed,reason,occurred_at FROM
(SELECT r.*,ROW_NUMBER() OVER(PARTITION BY comment_id ORDER BY occurred_at DESC,id DESC) AS rn FROM dbo.review_actions r) ranked WHERE rn=1;
GO
