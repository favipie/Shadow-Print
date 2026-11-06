import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comments,profiles,devices,logins,initialCases} from '../../src/lib/investigation-data';
const read=(n:string)=>readFileSync(new URL(n,import.meta.url),'utf8').replaceAll('\r\n','\n');
const literal=(s:string)=>`N'${s.replaceAll("'","''")}'`;
test('all 22 original tables and foreign keys preserved',()=>{
 const source=read('../001_schema.sql'),target=read('001_schema.sql');
 assert.deepEqual([...source.matchAll(/CREATE TABLE (\w+)/g)].map(m=>m[1]),[...target.matchAll(/CREATE TABLE dbo\.(\w+)/g)].map(m=>m[1]));
 assert.equal((source.match(/FOREIGN KEY/g)||[]).length,(target.match(/FOREIGN KEY/g)||[]).length);
 assert.equal((target.match(/CREATE UNIQUE INDEX ux_evidence_/g)||[]).length,3);
});
test('every comment value and original fixture count preserved',()=>{
 const seed=read('004_seed.sql');
 for(const c of comments){const values=[c.id,c.accountId,c.targetId,`P-${c.targetId}`,c.text,new Date(c.at).toISOString().replace('T',' ').replace('Z',''),'demo-v1',c.id];assert.ok(seed.includes(`VALUES (${values.map(literal).join(',')});`),c.id);}
 for(const [table,n] of [['accounts',profiles.length],['comments',comments.length],['comment_labels',25],['devices',devices.length],['login_events',logins.length],['investigations',initialCases.length]] as const) assert.equal(seed.split(`INSERT INTO dbo.${table} (`).length-1,n,table);
});
test('all source seed values survive conversion exactly',()=>{
 const source=read('../003_seed.sql').split('\n').filter(l=>l.startsWith('INSERT INTO ')).join('\n').replace(/CONVERT\(X'([0-9a-f]*)' USING utf8mb4\)/g,(_,h)=>literal(Buffer.from(h,'hex').toString('utf8'))).replaceAll('INSERT INTO ','INSERT INTO dbo.');
 assert.equal(read('004_seed.sql').split('\n').filter(l=>l.startsWith('INSERT INTO ')).join('\n'),source);
});
