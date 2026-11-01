-- MySQL >= 8.0.16; InnoDB, UTC. Apply once to an empty dedicated schema.
SET time_zone = '+00:00';
CREATE TABLE provenance (
 id VARCHAR(64) PRIMARY KEY, kind ENUM('synthetic','public_dataset','manual_review') NOT NULL,
 name VARCHAR(255) NOT NULL, version VARCHAR(100) NOT NULL,
 source_url VARCHAR(1000), license_text TEXT NOT NULL, description TEXT NOT NULL,
 CHECK (kind <> 'public_dataset' OR source_url IS NOT NULL)
) ENGINE=InnoDB;
CREATE TABLE accounts (
 id VARCHAR(64) PRIMARY KEY, handle VARCHAR(100) NOT NULL UNIQUE,
 created_at DATETIME(3) NOT NULL, bio TEXT NOT NULL,
 provenance_id VARCHAR(64) NOT NULL, source_record_id VARCHAR(128) NOT NULL,
 FOREIGN KEY (provenance_id) REFERENCES provenance(id), UNIQUE(provenance_id,source_record_id)
) ENGINE=InnoDB;
CREATE TABLE posts (
 id VARCHAR(64) PRIMARY KEY, author_id VARCHAR(64) NOT NULL, body TEXT NOT NULL,
 created_at DATETIME(3) NOT NULL, provenance_id VARCHAR(64) NOT NULL,
 FOREIGN KEY(author_id) REFERENCES accounts(id), FOREIGN KEY(provenance_id) REFERENCES provenance(id)
) ENGINE=InnoDB;
CREATE TABLE comments (
 id VARCHAR(64) PRIMARY KEY, author_id VARCHAR(64) NOT NULL, target_id VARCHAR(64) NOT NULL,
 post_id VARCHAR(64) NOT NULL, body TEXT NOT NULL, created_at DATETIME(3) NOT NULL,
 provenance_id VARCHAR(64) NOT NULL, source_record_id VARCHAR(128) NOT NULL,
 FOREIGN KEY(author_id) REFERENCES accounts(id), FOREIGN KEY(target_id) REFERENCES accounts(id),
 FOREIGN KEY(post_id) REFERENCES posts(id), FOREIGN KEY(provenance_id) REFERENCES provenance(id),
 UNIQUE(provenance_id,source_record_id), INDEX ix_author_time(author_id,created_at),
 INDEX ix_target_time(target_id,created_at), INDEX ix_comment_time(created_at)
) ENGINE=InnoDB;
CREATE TABLE devices (
 id VARCHAR(64) PRIMARY KEY, display_name VARCHAR(255) NOT NULL, context TEXT NOT NULL,
 provenance_id VARCHAR(64) NOT NULL, FOREIGN KEY(provenance_id) REFERENCES provenance(id)
) ENGINE=InnoDB;
CREATE TABLE login_events (
 id VARCHAR(64) PRIMARY KEY, account_id VARCHAR(64) NOT NULL, device_id VARCHAR(64) NOT NULL,
 occurred_at DATETIME(3) NOT NULL, provenance_id VARCHAR(64) NOT NULL,
 FOREIGN KEY(account_id) REFERENCES accounts(id), FOREIGN KEY(device_id) REFERENCES devices(id),
 FOREIGN KEY(provenance_id) REFERENCES provenance(id), INDEX ix_device_time(device_id,occurred_at)
) ENGINE=InnoDB;
-- Interactions exclude comments/logins: those have their own authoritative records.
CREATE TABLE interactions (
 id VARCHAR(64) PRIMARY KEY, actor_id VARCHAR(64) NOT NULL, post_id VARCHAR(64) NOT NULL,
 kind ENUM('like','share') NOT NULL, occurred_at DATETIME(3) NOT NULL,
 provenance_id VARCHAR(64) NOT NULL, FOREIGN KEY(actor_id) REFERENCES accounts(id),
 FOREIGN KEY(post_id) REFERENCES posts(id), FOREIGN KEY(provenance_id) REFERENCES provenance(id),
 INDEX ix_interaction_post(post_id,occurred_at)
) ENGINE=InnoDB;
CREATE TABLE label_types (code VARCHAR(64) PRIMARY KEY, description TEXT NOT NULL) ENGINE=InnoDB;
CREATE TABLE comment_labels (
 comment_id VARCHAR(64) NOT NULL, label_code VARCHAR(64) NOT NULL, provenance_id VARCHAR(64) NOT NULL,
 label_method ENUM('Authored label','Rule example','Public dataset','Human review') NOT NULL,
 PRIMARY KEY(comment_id,label_code,provenance_id), FOREIGN KEY(comment_id) REFERENCES comments(id),
 FOREIGN KEY(label_code) REFERENCES label_types(code), FOREIGN KEY(provenance_id) REFERENCES provenance(id)
) ENGINE=InnoDB;
CREATE TABLE detection_rules (
 code VARCHAR(32) NOT NULL, version INT NOT NULL, description TEXT NOT NULL,
 min_count INT NOT NULL, window_seconds INT NOT NULL, weight INT NOT NULL,
 PRIMARY KEY(code,version), CHECK(version > 0), CHECK(min_count > 0),
 CHECK(window_seconds > 0), CHECK(weight BETWEEN 0 AND 100)
) ENGINE=InnoDB;
CREATE TABLE detection_runs (
 id VARCHAR(64) PRIMARY KEY, executed_at DATETIME(3) NOT NULL, engine_version VARCHAR(100) NOT NULL,
 description TEXT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE findings (
 id VARCHAR(64) PRIMARY KEY, run_id VARCHAR(64) NOT NULL, rule_code VARCHAR(32) NOT NULL,
 rule_version INT NOT NULL, account_id VARCHAR(64) NOT NULL, anchor_comment_id VARCHAR(64) NOT NULL,
 explanation TEXT NOT NULL, FOREIGN KEY(run_id) REFERENCES detection_runs(id),
 FOREIGN KEY(rule_code,rule_version) REFERENCES detection_rules(code,version),
 FOREIGN KEY(account_id) REFERENCES accounts(id), FOREIGN KEY(anchor_comment_id) REFERENCES comments(id),
 UNIQUE(run_id,rule_code,rule_version,account_id,anchor_comment_id)
) ENGINE=InnoDB;
-- Typed foreign keys: exactly one original record per evidence item, no unvalidated polymorphic IDs.
CREATE TABLE evidence (
 id VARCHAR(64) PRIMARY KEY, comment_id VARCHAR(64) UNIQUE, login_id VARCHAR(64) UNIQUE,
 interaction_id VARCHAR(64) UNIQUE,
 FOREIGN KEY(comment_id) REFERENCES comments(id), FOREIGN KEY(login_id) REFERENCES login_events(id),
 FOREIGN KEY(interaction_id) REFERENCES interactions(id),
 CHECK((comment_id IS NOT NULL)+(login_id IS NOT NULL)+(interaction_id IS NOT NULL)=1)
) ENGINE=InnoDB;
CREATE TABLE finding_evidence (
 finding_id VARCHAR(64) NOT NULL, evidence_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(finding_id,evidence_id), FOREIGN KEY(finding_id) REFERENCES findings(id),
 FOREIGN KEY(evidence_id) REFERENCES evidence(id)
) ENGINE=InnoDB;
CREATE TABLE investigators (id VARCHAR(64) PRIMARY KEY, display_name VARCHAR(100) NOT NULL) ENGINE=InnoDB;
CREATE TABLE investigations (
 id VARCHAR(64) PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT NOT NULL,
 status ENUM('Open','Under review','Needs more evidence','Resolved','Closed') NOT NULL,
 decision TEXT NOT NULL, updated_at DATETIME(3) NOT NULL,
 CHECK(status NOT IN ('Resolved','Closed') OR CHAR_LENGTH(TRIM(decision)) > 0)
) ENGINE=InnoDB;
CREATE TABLE investigation_accounts (
 investigation_id VARCHAR(64) NOT NULL, account_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(investigation_id,account_id), FOREIGN KEY(investigation_id) REFERENCES investigations(id),
 FOREIGN KEY(account_id) REFERENCES accounts(id)
) ENGINE=InnoDB;
CREATE TABLE investigation_evidence (
 investigation_id VARCHAR(64) NOT NULL, evidence_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(investigation_id,evidence_id), FOREIGN KEY(investigation_id) REFERENCES investigations(id),
 FOREIGN KEY(evidence_id) REFERENCES evidence(id)
) ENGINE=InnoDB;
CREATE TABLE investigation_findings (
 investigation_id VARCHAR(64) NOT NULL, finding_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(investigation_id,finding_id), FOREIGN KEY(investigation_id) REFERENCES investigations(id),
 FOREIGN KEY(finding_id) REFERENCES findings(id)
) ENGINE=InnoDB;
CREATE TABLE case_notes (
 id VARCHAR(64) PRIMARY KEY, investigation_id VARCHAR(64) NOT NULL, investigator_id VARCHAR(64) NOT NULL,
 body TEXT NOT NULL, created_at DATETIME(3) NOT NULL, CHECK(CHAR_LENGTH(TRIM(body))>0),
 FOREIGN KEY(investigation_id) REFERENCES investigations(id), FOREIGN KEY(investigator_id) REFERENCES investigators(id)
) ENGINE=InnoDB;
CREATE TABLE review_actions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, comment_id VARCHAR(64) NOT NULL,
 investigator_id VARCHAR(64) NOT NULL, reviewed BOOLEAN NOT NULL, reason TEXT NOT NULL,
 occurred_at DATETIME(3) NOT NULL, CHECK(reviewed IN (0,1)),
 FOREIGN KEY(comment_id) REFERENCES comments(id), FOREIGN KEY(investigator_id) REFERENCES investigators(id),
 INDEX ix_review_latest(comment_id,occurred_at,id)
) ENGINE=InnoDB;
CREATE TABLE audit_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, investigator_id VARCHAR(64) NOT NULL,
 investigation_id VARCHAR(64), review_action_id BIGINT UNSIGNED,
 action VARCHAR(64) NOT NULL, old_value JSON, new_value JSON, occurred_at DATETIME(3) NOT NULL,
 FOREIGN KEY(investigator_id) REFERENCES investigators(id),
 FOREIGN KEY(investigation_id) REFERENCES investigations(id), FOREIGN KEY(review_action_id) REFERENCES review_actions(id),
 CHECK((investigation_id IS NOT NULL)+(review_action_id IS NOT NULL)=1)
) ENGINE=InnoDB;
