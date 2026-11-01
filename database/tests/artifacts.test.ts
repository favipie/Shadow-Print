import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generate,literal} from '../generate';
import {profiles,comments,logins,initialCases} from '../../src/lib/investigation-data';
import {statements} from '../sql-runner.mjs';
test('committed seed exactly reproduces the Phase 2 fixtures',()=>{
 const sql=generate();assert.equal(sql,readFileSync(new URL('../003_seed.sql',import.meta.url),'utf8'));
 for(const c of comments){assert.ok(sql.includes(literal(c.text)));assert.ok(sql.includes(literal(c.id)));}
 for(const [table,count] of [['accounts',profiles.length],['comments',comments.length],['login_events',logins.length],['investigations',initialCases.length]] as const)
 assert.equal(sql.split(`INSERT INTO ${table} (`).length-1,count);
 assert.equal(sql.split('INSERT INTO comment_labels (').length-1,25);
});
test('workload is deterministic and preserves originals with explicit provenance',()=>{
 assert.equal(generate(1000,7),generate(1000,7));assert.notEqual(generate(1000,7),generate(1000,8));
 const sql=generate(1000,7);assert.equal(sql.split('INSERT INTO comments (').length-1,1046);
 assert.ok(sql.includes(literal('generated-v1')));assert.ok(sql.includes(literal('C-501')));
 assert.throws(()=>generate(-1));assert.throws(()=>generate(1.5));
});
test('SQL artifacts split procedures without splitting their transactional bodies',()=>{
 const sql=readFileSync(new URL('../002_detection.sql',import.meta.url),'utf8');
 const parsed=statements(sql);assert.equal(parsed.filter((s:string)=>s.startsWith('CREATE PROCEDURE')).length,3);
 assert.ok(parsed.some((s:string)=>s.includes('ROLLBACK; RESIGNAL;')&&s.includes('COMMIT;')));
 assert.throws(()=>statements('SELECT 1'));
});
test('literal encoding prevents source text from becoming SQL syntax',()=>{
 assert.equal(literal("a'\\\n"),"CONVERT(X'61275c0a' USING utf8mb4)");assert.equal(literal(null),'NULL');
});
