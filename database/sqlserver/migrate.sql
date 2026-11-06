:ON ERROR EXIT
-- Run from database/sqlserver using sqlcmd or SSMS SQLCMD mode.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
IF CONVERT(NVARCHAR(128),SERVERPROPERTY('ServerName'))<>N'favipie\SQLEXPRESS' OR DB_NAME()<>N'shadowprint_db'
 THROW 51000,'Unexpected server/database: migration refused',1;
IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0) THROW 51000,'Database is not empty',1;
IF EXISTS(SELECT 1 FROM sys.objects WHERE is_ms_shipped=0 AND type IN('V','P','FN','IF','TF')) THROW 51000,'Existing programmable objects: migration refused',1;
BEGIN TRANSACTION;
GO
:r 001_schema.sql
:r 002_views.sql
:r 003_procedures.sql
:r 004_seed.sql
IF @@TRANCOUNT<>1 THROW 51000,'Unexpected transaction nesting',1;
COMMIT;
GO
-- Verification deliberately runs after migration commit and retains its audit history.
:r 006_verify.sql
:r 005_academic_queries.sql
