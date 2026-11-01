-- Explainable sliding windows. Labels are supplied annotations, never NLP predictions.
CREATE VIEW v_normalized_comments AS
SELECT c.*, LOWER(TRIM(REGEXP_REPLACE(body,'[[:space:]]+',' '))) COLLATE utf8mb4_0900_bin AS normalized_body
FROM comments c;
CREATE VIEW v_duplicate_windows AS
SELECT a.id AS anchor_id,a.author_id,COUNT(*) AS match_count
FROM v_normalized_comments a JOIN v_normalized_comments b
 ON b.author_id=a.author_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND TIMESTAMPADD(SECOND,1800,a.created_at)
GROUP BY a.id,a.author_id HAVING COUNT(*)>=5;
CREATE VIEW v_targeting_windows AS
SELECT a.id AS anchor_id,a.author_id,a.target_id,COUNT(*) AS match_count
FROM comments a JOIN comments b ON b.author_id=a.author_id AND b.target_id=a.target_id
 AND b.created_at BETWEEN a.created_at AND TIMESTAMPADD(SECOND,86400,a.created_at)
WHERE EXISTS (SELECT 1 FROM comment_labels l WHERE l.comment_id=b.id AND l.label_code='Repeated harassment')
GROUP BY a.id,a.author_id,a.target_id HAVING COUNT(*)>=6;
CREATE VIEW v_coordination_windows AS
SELECT a.id AS anchor_id,a.target_id,COUNT(DISTINCT b.author_id) AS account_count
FROM v_normalized_comments a JOIN v_normalized_comments b
 ON b.target_id=a.target_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND TIMESTAMPADD(SECOND,90,a.created_at)
GROUP BY a.id,a.target_id HAVING COUNT(DISTINCT b.author_id)>=3;
-- One row per evidence comment. Multiple qualifying windows are retained explicitly.
CREATE VIEW v_detection_evidence AS
SELECT 'REP-01' AS rule_code,w.anchor_id,b.author_id AS account_id,b.id AS comment_id
FROM v_duplicate_windows w JOIN v_normalized_comments a ON a.id=w.anchor_id
JOIN v_normalized_comments b ON b.author_id=a.author_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND TIMESTAMPADD(SECOND,1800,a.created_at)
UNION ALL
SELECT 'TARGET-01',w.anchor_id,b.author_id,b.id FROM v_targeting_windows w
JOIN comments a ON a.id=w.anchor_id JOIN comments b ON b.author_id=a.author_id AND b.target_id=a.target_id
 AND b.created_at BETWEEN a.created_at AND TIMESTAMPADD(SECOND,86400,a.created_at)
WHERE EXISTS(SELECT 1 FROM comment_labels l WHERE l.comment_id=b.id AND l.label_code='Repeated harassment')
UNION ALL
SELECT 'COORD-01',w.anchor_id,participant.author_id,b.id
FROM v_coordination_windows w JOIN v_normalized_comments a ON a.id=w.anchor_id
JOIN v_normalized_comments participant ON participant.target_id=a.target_id AND participant.normalized_body=a.normalized_body
 AND participant.created_at BETWEEN a.created_at AND TIMESTAMPADD(SECOND,90,a.created_at)
JOIN v_normalized_comments b ON b.target_id=a.target_id AND b.normalized_body=a.normalized_body
 AND b.created_at BETWEEN a.created_at AND TIMESTAMPADD(SECOND,90,a.created_at)
UNION ALL
SELECT 'THREAT-01',c.id,c.author_id,c.id FROM comments c
WHERE EXISTS(SELECT 1 FROM comment_labels l WHERE l.comment_id=c.id AND l.label_code='Threat-related language');
CREATE VIEW v_account_scores AS
SELECT a.id,COALESCE(SUM(r.weight),0) AS demo_score
FROM accounts a LEFT JOIN (SELECT DISTINCT account_id,rule_code FROM v_detection_evidence) d ON d.account_id=a.id
LEFT JOIN detection_rules r ON r.code=d.rule_code AND r.version=1 GROUP BY a.id;
CREATE VIEW v_latest_reviews AS
SELECT id,comment_id,investigator_id,reviewed,reason,occurred_at FROM
(SELECT r.*,ROW_NUMBER() OVER(PARTITION BY comment_id ORDER BY occurred_at DESC,id DESC) AS rn FROM review_actions r) ranked WHERE rn=1;
-- Version 1 windows above intentionally match immutable version-1 rule metadata.
DELIMITER $$
CREATE PROCEDURE run_detection(IN p_run VARCHAR(64))
SQL SECURITY INVOKER
BEGIN
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 INSERT INTO detection_runs VALUES(p_run,UTC_TIMESTAMP(3),'sql-v1','Review signals only; shared devices excluded');
 INSERT INTO evidence(id,comment_id)
 SELECT CONCAT('E-',c.id),c.id FROM comments c WHERE NOT EXISTS(SELECT 1 FROM evidence e WHERE e.comment_id=c.id);
 INSERT INTO findings(id,run_id,rule_code,rule_version,account_id,anchor_comment_id,explanation)
 SELECT SHA2(CONCAT(p_run,'|',d.rule_code,'|',d.account_id,'|',d.anchor_id),256),p_run,d.rule_code,1,d.account_id,d.anchor_id,
 CONCAT('SQL v1 ',d.rule_code,': ',COUNT(DISTINCT d.comment_id),' original evidence comments. Review context; not proof of intent or identity.')
 FROM v_detection_evidence d GROUP BY d.rule_code,d.account_id,d.anchor_id;
 INSERT INTO finding_evidence
 SELECT DISTINCT f.id,e.id FROM findings f JOIN v_detection_evidence d
 ON d.rule_code=f.rule_code AND d.account_id=f.account_id AND d.anchor_id=f.anchor_comment_id
 JOIN evidence e ON e.comment_id=d.comment_id WHERE f.run_id=p_run;
 COMMIT;
END$$
CREATE PROCEDURE review_comment(IN p_comment VARCHAR(64),IN p_actor VARCHAR(64),IN p_reviewed BOOLEAN,IN p_reason TEXT)
SQL SECURITY INVOKER
BEGIN
 DECLARE v_id BIGINT UNSIGNED;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 INSERT INTO review_actions(comment_id,investigator_id,reviewed,reason,occurred_at)
 VALUES(p_comment,p_actor,p_reviewed,p_reason,UTC_TIMESTAMP(3));
 SET v_id=LAST_INSERT_ID();
 INSERT INTO audit_history(investigator_id,review_action_id,action,new_value,occurred_at)
 VALUES(p_actor,v_id,'comment_review',JSON_OBJECT('reviewed',p_reviewed,'reason',p_reason),UTC_TIMESTAMP(3));
 COMMIT;
END$$
CREATE PROCEDURE change_case_status(IN p_case VARCHAR(64),IN p_actor VARCHAR(64),IN p_status VARCHAR(32),IN p_decision TEXT)
SQL SECURITY INVOKER
BEGIN
 DECLARE v_old VARCHAR(32) DEFAULT NULL;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 SELECT status INTO v_old FROM investigations WHERE id=p_case FOR UPDATE;
 IF v_old IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Unknown investigation'; END IF;
 UPDATE investigations SET status=p_status,decision=p_decision,updated_at=UTC_TIMESTAMP(3) WHERE id=p_case;
 INSERT INTO audit_history(investigator_id,investigation_id,action,old_value,new_value,occurred_at)
 VALUES(p_actor,p_case,'case_status',JSON_OBJECT('status',v_old),JSON_OBJECT('status',p_status,'decision',p_decision),UTC_TIMESTAMP(3));
 COMMIT;
END$$
DELIMITER ;
