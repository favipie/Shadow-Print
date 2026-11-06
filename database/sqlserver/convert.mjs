import {readFileSync,writeFileSync} from 'node:fs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8').replaceAll('\r\n','\n');
const write=(n,s)=>writeFileSync(new URL(n,import.meta.url),s);
const transaction=s=>`SET XACT_ABORT ON;\nBEGIN TRY\nBEGIN TRANSACTION;\n${s}\nCOMMIT;\nEND TRY\nBEGIN CATCH\nIF XACT_STATE() <> 0 ROLLBACK;\nTHROW;\nEND CATCH;\nGO\n`;
const tables=[...read('001_schema.sql').matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\) ENGINE=InnoDB;/g)];
let schema='-- Generated SQL Server schema; review before execution. No drops.\n';
for(const [,name,raw] of tables){
 let indexes=[];
 let body=raw.replace(/(\w+) ENUM\(([^)]+)\) NOT NULL/g,(_,col,values)=>`${col} NVARCHAR(64) NOT NULL CHECK (${col} IN (${values}))`)
 .replace(/BIGINT UNSIGNED AUTO_INCREMENT/g,'BIGINT IDENTITY(1,1) NOT NULL').replaceAll('BIGINT UNSIGNED','BIGINT')
 .replaceAll('VARCHAR(','NVARCHAR(').replaceAll('NNVARCHAR','NVARCHAR')
 .replaceAll('DATETIME(3)','DATETIME2(3)').replace(/\bTEXT\b/g,'NVARCHAR(MAX)').replace(/\bBOOLEAN\b/g,'BIT')
 .replace(/(\w+) JSON/g,(_,col)=>`${col} NVARCHAR(MAX) CHECK (${col} IS NULL OR ISJSON(${col})=1)`)
 .replaceAll('CHAR_LENGTH','LEN')
 .replace(/\((\w+) IS NOT NULL\)/g,'(CASE WHEN $1 IS NOT NULL THEN 1 ELSE 0 END)')
 .replace(/,\s*INDEX (\w+)\(([^)]+)\)/g,(_,idx,cols)=>{indexes.push(`CREATE INDEX ${idx} ON dbo.${name}(${cols});`);return '';})
 .replace(/REFERENCES (\w+)\(/g,'REFERENCES dbo.$1(');
 if(name==='evidence')body=body.replace(/(comment_id|login_id|interaction_id) NVARCHAR\(64\) UNIQUE/g,(_,col)=>{indexes.push(`CREATE UNIQUE INDEX ux_evidence_${col} ON dbo.evidence(${col}) WHERE ${col} IS NOT NULL;`);return `${col} NVARCHAR(64)`;});
 schema+=`CREATE TABLE dbo.${name} (${body});\n${indexes.join('\n')}\n`;
}
write('001_schema.sql',transaction(`IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0) THROW 51000,'Expected empty database',1;\n${schema}`));
// Native regex on SQL Server 2025 RTM cannot accept MAX input. A scalar normalizer
// preserves arbitrary-length content and ICU whitespace semantics without truncation.
const normalizer=`CREATE FUNCTION dbo.normalize_comment(@body NVARCHAR(MAX)) RETURNS NVARCHAR(MAX) AS
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
`;
let views=read('002_detection.sql').split('-- Version 1')[0]
 .replace("LOWER(TRIM(REGEXP_REPLACE(body,'[[:space:]]+',' '))) COLLATE utf8mb4_0900_bin",'dbo.normalize_comment(body) COLLATE Latin1_General_100_BIN2')
 .replaceAll('TIMESTAMPADD','DATEADD').replace(/CREATE VIEW (\w+)/g,'CREATE VIEW dbo.$1')
 .replace(/\b(FROM|JOIN) (\w+)/g,(_,op,table)=>`${op} dbo.${table}`).replaceAll(';\n',';\nGO\n');
write('002_views.sql',normalizer+views);
const seed=read('003_seed.sql').split('\n').filter(l=>l.startsWith('INSERT INTO ')).join('\n')
 .replace(/CONVERT\(X'([0-9a-f]*)' USING utf8mb4\)/g,(_,hex)=>"N'"+Buffer.from(hex,'hex').toString('utf8').replaceAll("'","''")+"'")
 .replaceAll('INSERT INTO ','INSERT INTO dbo.');
write('004_seed.sql',transaction(seed));
let academic=read('004_academic_queries.sql').replace('WITH RECURSIVE','WITH').replaceAll('TIMESTAMPDIFF','DATEDIFF')
 .replace("CAST('A-001' AS CHAR(64))","CAST(N'A-001' AS NVARCHAR(64))").replace("CAST('|A-001|' AS CHAR(2048))","CAST(N'|A-001|' AS NVARCHAR(2048))")
 .replace("CONCAT(w.path,e.target_id,'|')","CAST(CONCAT(w.path,e.target_id,'|') AS NVARCHAR(2048))")
 .replace("LOCATE(CONCAT('|',e.target_id,'|'),w.path)","CHARINDEX(CONCAT('|',e.target_id,'|'),w.path)")
 .replace('SELECT * FROM walk;','SELECT * FROM walk OPTION (MAXRECURSION 8);')
 .replace('EXPLAIN SELECT','SELECT').replace('START TRANSACTION;','BEGIN TRANSACTION;').replace("WHERE id='SP-0098' FOR UPDATE","WHERE id='SP-0098'")
 .replace('exercised by verify.mjs','exercised by 006_verify.sql');
write('005_academic_queries.sql',academic);
console.log(`Generated ${tables.length} tables, views, original seed and academic queries.`);
