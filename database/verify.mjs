import assert from 'node:assert/strict';
import {connect,apply} from './sql-runner.mjs';
const db=await connect();
const rows=async(sql,args=[])=> (await db.execute(sql,args))[0];
try{
 for(const [table,n] of [['accounts',9],['comments',28],['devices',6],['login_events',8],['investigations',3],['comment_labels',25]])
 assert.equal(Number((await rows(`SELECT COUNT(*) AS n FROM ${table}`))[0].n),n,table);
 const scores=Object.fromEntries((await rows('SELECT * FROM v_account_scores')).map(r=>[r.id,Number(r.demo_score)]));
 assert.deepEqual(scores,{'A-001':30,'A-002':55,'A-003':50,'A-004':25,'A-005':0,'A-006':25,'A-007':0,'A-008':0,'U-021':0});
 assert.deepEqual((await rows('SELECT anchor_id,account_count FROM v_coordination_windows')).map(r=>[r.anchor_id,Number(r.account_count)]),[['C-410',3]]);
 await db.beginTransaction();
 await assert.rejects(db.query("UPDATE comments SET author_id='missing' WHERE id='C-501'"));
 await assert.rejects(db.query("INSERT INTO evidence(id) VALUES('INVALID')"));
 await assert.rejects(db.query("UPDATE investigations SET status='Closed' WHERE id='SP-0098'"));
 await db.query("UPDATE comments SET created_at='2026-10-18 14:32:36' WHERE id='C-412'");
 assert.equal((await rows('SELECT * FROM v_coordination_windows')).length,0,'91 seconds must not qualify');
 await db.rollback();
 await apply(db,'004_academic_queries.sql');
 const run=`verify-${Date.now()}`;
 await db.execute('CALL run_detection(?)',[run]);
 assert.equal(Number((await rows('SELECT COUNT(*) AS n FROM findings WHERE run_id=?',[run]))[0].n),11);
 assert.equal(Number((await rows('SELECT COUNT(*) AS n FROM findings f LEFT JOIN finding_evidence e ON e.finding_id=f.id WHERE f.run_id=? AND e.evidence_id IS NULL',[run]))[0].n),0);
 await db.execute('CALL review_comment(?,?,?,?)',['C-501','DEMO-ANALYST',1,'Integration test']);
 assert.equal((await rows("SELECT reviewed FROM v_latest_reviews WHERE comment_id='C-501'"))[0].reviewed,1);
 await db.execute('CALL review_comment(?,?,?,?)',['C-501','DEMO-ANALYST',0,'Integration test restore']);
 await assert.rejects(db.execute('CALL change_case_status(?,?,?,?)',['SP-0098','DEMO-ANALYST','Closed','']));
 await db.execute('CALL change_case_status(?,?,?,?)',['SP-0098','DEMO-ANALYST','Closed','Benign shared-device control']);
 await db.execute('CALL change_case_status(?,?,?,?)',['SP-0098','DEMO-ANALYST','Open','']);
 assert.ok(Number((await rows('SELECT COUNT(*) AS n FROM audit_history'))[0].n)>=4);
 console.log('PASS: demo counts, SQL scores, negative controls, exact window boundary, FKs/CHECKs, academic SQL, detection evidence, reviews, case transaction/audit. Test history retained.');
}finally{await db.rollback();await db.end();}
