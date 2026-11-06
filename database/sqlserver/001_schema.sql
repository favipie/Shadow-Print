-- Exported read-only from the verified SQL Server schema. Fresh test databases only.
CREATE TABLE dbo.[accounts] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [handle] nvarchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [created_at] datetime2(3) NOT NULL,
 [bio] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [provenance_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [source_record_id] nvarchar(128) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[audit_history] (
 [id] bigint IDENTITY(1,1) NOT NULL,
 [investigator_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [investigation_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 [review_action_id] bigint NULL,
 [action] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [old_value] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 [new_value] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 [occurred_at] datetime2(3) NOT NULL
);
GO
CREATE TABLE dbo.[case_notes] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [investigation_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [investigator_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [body] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [created_at] datetime2(3) NOT NULL
);
GO
CREATE TABLE dbo.[comment_labels] (
 [comment_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [label_code] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [provenance_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [label_method] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[comments] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [author_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [target_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [post_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [body] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [created_at] datetime2(3) NOT NULL,
 [provenance_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [source_record_id] nvarchar(128) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[detection_rules] (
 [code] nvarchar(32) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [version] int NOT NULL,
 [description] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [min_count] int NOT NULL,
 [window_seconds] int NOT NULL,
 [weight] int NOT NULL
);
GO
CREATE TABLE dbo.[detection_runs] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [executed_at] datetime2(3) NOT NULL,
 [engine_version] nvarchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [description] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[devices] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [display_name] nvarchar(255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [context] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [provenance_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[evidence] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [comment_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 [login_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 [interaction_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL
);
GO
CREATE TABLE dbo.[finding_evidence] (
 [finding_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [evidence_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[findings] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [run_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [rule_code] nvarchar(32) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [rule_version] int NOT NULL,
 [account_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [anchor_comment_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [explanation] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[interactions] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [actor_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [post_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [kind] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [occurred_at] datetime2(3) NOT NULL,
 [provenance_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[investigation_accounts] (
 [investigation_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [account_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[investigation_evidence] (
 [investigation_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [evidence_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[investigation_findings] (
 [investigation_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [finding_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[investigations] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [title] nvarchar(255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [description] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [status] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [decision] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [updated_at] datetime2(3) NOT NULL
);
GO
CREATE TABLE dbo.[investigators] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [display_name] nvarchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[label_types] (
 [code] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [description] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[login_events] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [account_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [device_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [occurred_at] datetime2(3) NOT NULL,
 [provenance_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[posts] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [author_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [body] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [created_at] datetime2(3) NOT NULL,
 [provenance_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[provenance] (
 [id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [kind] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [name] nvarchar(255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [version] nvarchar(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [source_url] nvarchar(1000) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
 [license_text] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [description] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
);
GO
CREATE TABLE dbo.[review_actions] (
 [id] bigint IDENTITY(1,1) NOT NULL,
 [comment_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [investigator_id] nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [reviewed] bit NOT NULL,
 [reason] nvarchar(max) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
 [occurred_at] datetime2(3) NOT NULL
);
GO
ALTER TABLE dbo.[accounts] ADD CONSTRAINT [PK__accounts__3213E83FF0BDAD3C] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[accounts] ADD CONSTRAINT [UQ__accounts__EC3FCF6F0EA78824] UNIQUE NONCLUSTERED ([provenance_id],[source_record_id]);
GO
ALTER TABLE dbo.[accounts] ADD CONSTRAINT [UQ__accounts__7ED567C077554EBC] UNIQUE NONCLUSTERED ([handle]);
GO
ALTER TABLE dbo.[audit_history] ADD CONSTRAINT [PK__audit_hi__3213E83FC6C71272] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[audit_history] ADD CONSTRAINT [CK__audit_his__old_v__37703C52] CHECK ([old_value] IS NULL OR isjson([old_value])=(1));
GO
ALTER TABLE dbo.[audit_history] ADD CONSTRAINT [CK__audit_his__new_v__3864608B] CHECK ([new_value] IS NULL OR isjson([new_value])=(1));
GO
ALTER TABLE dbo.[audit_history] ADD CONSTRAINT [CK__audit_history__3C34F16F] CHECK ((case when [investigation_id] IS NOT NULL then (1) else (0) end+case when [review_action_id] IS NOT NULL then (1) else (0) end)=(1));
GO
ALTER TABLE dbo.[case_notes] ADD CONSTRAINT [PK__case_not__3213E83FEA9C0DE0] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[case_notes] ADD CONSTRAINT [CK__case_notes__body__2DE6D218] CHECK (len(Trim([body]))>(0));
GO
ALTER TABLE dbo.[comment_labels] ADD CONSTRAINT [PK__comment___15D37D8541EA0DC5] PRIMARY KEY CLUSTERED ([comment_id],[label_code],[provenance_id]);
GO
ALTER TABLE dbo.[comment_labels] ADD CONSTRAINT [CK__comment_l__label__7F2BE32F] CHECK ([label_method]='Human review' OR [label_method]='Public dataset' OR [label_method]='Rule example' OR [label_method]='Authored label');
GO
ALTER TABLE dbo.[comments] ADD CONSTRAINT [PK__comments__3213E83FE51BD4D0] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[comments] ADD CONSTRAINT [UQ__comments__EC3FCF6F77696444] UNIQUE NONCLUSTERED ([provenance_id],[source_record_id]);
GO
CREATE NONCLUSTERED INDEX [ix_author_time] ON dbo.[comments] ([author_id],[created_at]);
GO
CREATE NONCLUSTERED INDEX [ix_target_time] ON dbo.[comments] ([target_id],[created_at]);
GO
CREATE NONCLUSTERED INDEX [ix_comment_time] ON dbo.[comments] ([created_at]);
GO
ALTER TABLE dbo.[detection_rules] ADD CONSTRAINT [PK__detectio__E2E6106CDF06513C] PRIMARY KEY CLUSTERED ([code],[version]);
GO
ALTER TABLE dbo.[detection_rules] ADD CONSTRAINT [CK__detection__versi__04E4BC85] CHECK ([version]>(0));
GO
ALTER TABLE dbo.[detection_rules] ADD CONSTRAINT [CK__detection__min_c__05D8E0BE] CHECK ([min_count]>(0));
GO
ALTER TABLE dbo.[detection_rules] ADD CONSTRAINT [CK__detection__windo__06CD04F7] CHECK ([window_seconds]>(0));
GO
ALTER TABLE dbo.[detection_rules] ADD CONSTRAINT [CK__detection__weigh__07C12930] CHECK ([weight]>=(0) AND [weight]<=(100));
GO
ALTER TABLE dbo.[detection_runs] ADD CONSTRAINT [PK__detectio__3213E83FF9D8E401] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[devices] ADD CONSTRAINT [PK__devices__3213E83F601B5DDF] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[evidence] ADD CONSTRAINT [PK__evidence__3213E83F5710E32C] PRIMARY KEY CLUSTERED ([id]);
GO
CREATE UNIQUE NONCLUSTERED INDEX [ux_evidence_comment_id] ON dbo.[evidence] ([comment_id]) WHERE ([comment_id] IS NOT NULL);
GO
CREATE UNIQUE NONCLUSTERED INDEX [ux_evidence_login_id] ON dbo.[evidence] ([login_id]) WHERE ([login_id] IS NOT NULL);
GO
CREATE UNIQUE NONCLUSTERED INDEX [ux_evidence_interaction_id] ON dbo.[evidence] ([interaction_id]) WHERE ([interaction_id] IS NOT NULL);
GO
ALTER TABLE dbo.[evidence] ADD CONSTRAINT [CK__evidence__160F4887] CHECK (((case when [comment_id] IS NOT NULL then (1) else (0) end+case when [login_id] IS NOT NULL then (1) else (0) end)+case when [interaction_id] IS NOT NULL then (1) else (0) end)=(1));
GO
ALTER TABLE dbo.[finding_evidence] ADD CONSTRAINT [PK__finding___5B8C8D2C24DF2864] PRIMARY KEY CLUSTERED ([finding_id],[evidence_id]);
GO
ALTER TABLE dbo.[findings] ADD CONSTRAINT [PK__findings__3213E83F88402E60] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[findings] ADD CONSTRAINT [UQ__findings__C3F3EAEBC83A953B] UNIQUE NONCLUSTERED ([run_id],[rule_code],[rule_version],[account_id],[anchor_comment_id]);
GO
ALTER TABLE dbo.[interactions] ADD CONSTRAINT [PK__interact__3213E83F0F075725] PRIMARY KEY CLUSTERED ([id]);
GO
CREATE NONCLUSTERED INDEX [ix_interaction_post] ON dbo.[interactions] ([post_id],[occurred_at]);
GO
ALTER TABLE dbo.[interactions] ADD CONSTRAINT [CK__interactio__kind__778AC167] CHECK ([kind]='share' OR [kind]='like');
GO
ALTER TABLE dbo.[investigation_accounts] ADD CONSTRAINT [PK__investig__4101008DC0644D80] PRIMARY KEY CLUSTERED ([investigation_id],[account_id]);
GO
ALTER TABLE dbo.[investigation_evidence] ADD CONSTRAINT [PK__investig__79328529AAB5F2AD] PRIMARY KEY CLUSTERED ([investigation_id],[evidence_id]);
GO
ALTER TABLE dbo.[investigation_findings] ADD CONSTRAINT [PK__investig__DF16700B21D384DB] PRIMARY KEY CLUSTERED ([investigation_id],[finding_id]);
GO
ALTER TABLE dbo.[investigations] ADD CONSTRAINT [PK__investig__3213E83F51BD5506] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[investigations] ADD CONSTRAINT [CK__investiga__statu__1EA48E88] CHECK ([status]='Closed' OR [status]='Resolved' OR [status]='Needs more evidence' OR [status]='Under review' OR [status]='Open');
GO
ALTER TABLE dbo.[investigations] ADD CONSTRAINT [CK__investigations__1F98B2C1] CHECK (NOT ([status]='Closed' OR [status]='Resolved') OR len(Trim([decision]))>(0));
GO
ALTER TABLE dbo.[investigators] ADD CONSTRAINT [PK__investig__3213E83FC9F1C1FD] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[label_types] ADD CONSTRAINT [PK__label_ty__357D4CF8AFBDEEBF] PRIMARY KEY CLUSTERED ([code]);
GO
ALTER TABLE dbo.[login_events] ADD CONSTRAINT [PK__login_ev__3213E83F391B79BD] PRIMARY KEY CLUSTERED ([id]);
GO
CREATE NONCLUSTERED INDEX [ix_device_time] ON dbo.[login_events] ([device_id],[occurred_at]);
GO
ALTER TABLE dbo.[posts] ADD CONSTRAINT [PK__posts__3213E83F836DAC67] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[provenance] ADD CONSTRAINT [PK__provenan__3213E83F3701AE3C] PRIMARY KEY CLUSTERED ([id]);
GO
ALTER TABLE dbo.[provenance] ADD CONSTRAINT [CK__provenance__kind__5CD6CB2B] CHECK ([kind]='manual_review' OR [kind]='public_dataset' OR [kind]='synthetic');
GO
ALTER TABLE dbo.[provenance] ADD CONSTRAINT [CK__provenance__5DCAEF64] CHECK ([kind]<>'public_dataset' OR [source_url] IS NOT NULL);
GO
ALTER TABLE dbo.[review_actions] ADD CONSTRAINT [PK__review_a__3213E83F68DAD6CE] PRIMARY KEY CLUSTERED ([id]);
GO
CREATE NONCLUSTERED INDEX [ix_review_latest] ON dbo.[review_actions] ([comment_id],[occurred_at],[id]);
GO
ALTER TABLE dbo.[review_actions] ADD CONSTRAINT [CK__review_ac__revie__32AB8735] CHECK ([reviewed]=(1) OR [reviewed]=(0));
GO
ALTER TABLE dbo.[accounts] ADD CONSTRAINT [FK__accounts__proven__628FA481] FOREIGN KEY ([provenance_id]) REFERENCES dbo.[provenance] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[audit_history] ADD CONSTRAINT [FK__audit_his__inves__395884C4] FOREIGN KEY ([investigator_id]) REFERENCES dbo.[investigators] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[audit_history] ADD CONSTRAINT [FK__audit_his__inves__3A4CA8FD] FOREIGN KEY ([investigation_id]) REFERENCES dbo.[investigations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[audit_history] ADD CONSTRAINT [FK__audit_his__revie__3B40CD36] FOREIGN KEY ([review_action_id]) REFERENCES dbo.[review_actions] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[case_notes] ADD CONSTRAINT [FK__case_note__inves__2EDAF651] FOREIGN KEY ([investigation_id]) REFERENCES dbo.[investigations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[case_notes] ADD CONSTRAINT [FK__case_note__inves__2FCF1A8A] FOREIGN KEY ([investigator_id]) REFERENCES dbo.[investigators] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[comment_labels] ADD CONSTRAINT [FK__comment_l__comme__00200768] FOREIGN KEY ([comment_id]) REFERENCES dbo.[comments] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[comment_labels] ADD CONSTRAINT [FK__comment_l__label__01142BA1] FOREIGN KEY ([label_code]) REFERENCES dbo.[label_types] ([code]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[comment_labels] ADD CONSTRAINT [FK__comment_l__prove__02084FDA] FOREIGN KEY ([provenance_id]) REFERENCES dbo.[provenance] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[comments] ADD CONSTRAINT [FK__comments__author__6A30C649] FOREIGN KEY ([author_id]) REFERENCES dbo.[accounts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[comments] ADD CONSTRAINT [FK__comments__target__6B24EA82] FOREIGN KEY ([target_id]) REFERENCES dbo.[accounts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[comments] ADD CONSTRAINT [FK__comments__post_i__6C190EBB] FOREIGN KEY ([post_id]) REFERENCES dbo.[posts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[comments] ADD CONSTRAINT [FK__comments__proven__6D0D32F4] FOREIGN KEY ([provenance_id]) REFERENCES dbo.[provenance] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[devices] ADD CONSTRAINT [FK__devices__provena__6FE99F9F] FOREIGN KEY ([provenance_id]) REFERENCES dbo.[provenance] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[evidence] ADD CONSTRAINT [FK__evidence__commen__1332DBDC] FOREIGN KEY ([comment_id]) REFERENCES dbo.[comments] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[evidence] ADD CONSTRAINT [FK__evidence__login___14270015] FOREIGN KEY ([login_id]) REFERENCES dbo.[login_events] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[evidence] ADD CONSTRAINT [FK__evidence__intera__151B244E] FOREIGN KEY ([interaction_id]) REFERENCES dbo.[interactions] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[finding_evidence] ADD CONSTRAINT [FK__finding_e__findi__18EBB532] FOREIGN KEY ([finding_id]) REFERENCES dbo.[findings] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[finding_evidence] ADD CONSTRAINT [FK__finding_e__evide__19DFD96B] FOREIGN KEY ([evidence_id]) REFERENCES dbo.[evidence] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[findings] ADD CONSTRAINT [FK__findings__run_id__0D7A0286] FOREIGN KEY ([run_id]) REFERENCES dbo.[detection_runs] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[findings] ADD CONSTRAINT [FK__findings__0E6E26BF] FOREIGN KEY ([rule_code],[rule_version]) REFERENCES dbo.[detection_rules] ([code],[version]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[findings] ADD CONSTRAINT [FK__findings__accoun__0F624AF8] FOREIGN KEY ([account_id]) REFERENCES dbo.[accounts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[findings] ADD CONSTRAINT [FK__findings__anchor__10566F31] FOREIGN KEY ([anchor_comment_id]) REFERENCES dbo.[comments] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[interactions] ADD CONSTRAINT [FK__interacti__actor__787EE5A0] FOREIGN KEY ([actor_id]) REFERENCES dbo.[accounts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[interactions] ADD CONSTRAINT [FK__interacti__post___797309D9] FOREIGN KEY ([post_id]) REFERENCES dbo.[posts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[interactions] ADD CONSTRAINT [FK__interacti__prove__7A672E12] FOREIGN KEY ([provenance_id]) REFERENCES dbo.[provenance] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[investigation_accounts] ADD CONSTRAINT [FK__investiga__inves__22751F6C] FOREIGN KEY ([investigation_id]) REFERENCES dbo.[investigations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[investigation_accounts] ADD CONSTRAINT [FK__investiga__accou__236943A5] FOREIGN KEY ([account_id]) REFERENCES dbo.[accounts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[investigation_evidence] ADD CONSTRAINT [FK__investiga__inves__2645B050] FOREIGN KEY ([investigation_id]) REFERENCES dbo.[investigations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[investigation_evidence] ADD CONSTRAINT [FK__investiga__evide__2739D489] FOREIGN KEY ([evidence_id]) REFERENCES dbo.[evidence] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[investigation_findings] ADD CONSTRAINT [FK__investiga__inves__2A164134] FOREIGN KEY ([investigation_id]) REFERENCES dbo.[investigations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[investigation_findings] ADD CONSTRAINT [FK__investiga__findi__2B0A656D] FOREIGN KEY ([finding_id]) REFERENCES dbo.[findings] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[login_events] ADD CONSTRAINT [FK__login_eve__accou__72C60C4A] FOREIGN KEY ([account_id]) REFERENCES dbo.[accounts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[login_events] ADD CONSTRAINT [FK__login_eve__devic__73BA3083] FOREIGN KEY ([device_id]) REFERENCES dbo.[devices] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[login_events] ADD CONSTRAINT [FK__login_eve__prove__74AE54BC] FOREIGN KEY ([provenance_id]) REFERENCES dbo.[provenance] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[posts] ADD CONSTRAINT [FK__posts__author_id__656C112C] FOREIGN KEY ([author_id]) REFERENCES dbo.[accounts] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[posts] ADD CONSTRAINT [FK__posts__provenanc__66603565] FOREIGN KEY ([provenance_id]) REFERENCES dbo.[provenance] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[review_actions] ADD CONSTRAINT [FK__review_ac__comme__339FAB6E] FOREIGN KEY ([comment_id]) REFERENCES dbo.[comments] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
ALTER TABLE dbo.[review_actions] ADD CONSTRAINT [FK__review_ac__inves__3493CFA7] FOREIGN KEY ([investigator_id]) REFERENCES dbo.[investigators] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
GO
