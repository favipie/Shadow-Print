import {profiles,comments,devices,logins,initialCases} from '../src/lib/investigation-data';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// UTF-8 hex literals avoid SQL-mode/backslash/quote ambiguity.
export const literal=(v:unknown):string=>v===null?'NULL':typeof v==='number'?String(v):`CONVERT(X'${Buffer.from(String(v)).toString('hex')}' USING utf8mb4)`;
const date=(v:string)=>new Date(v).toISOString().replace('T',' ').replace('Z','');
export function generate(extra=0,seed=42){
 if(!Number.isInteger(extra)||extra<0||extra>100000) throw Error('extra must be 0..100000');
 let state=seed>>>0; const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const lines=['-- Generated from Phase 2 originals; UTC. Apply once after schema and views.','START TRANSACTION;'];
 const insert=(table:string,cols:string,values:unknown[])=>lines.push(`INSERT INTO ${table} (${cols}) VALUES (${values.map(literal).join(',')});`);
 insert('provenance','id,kind,name,version,license_text,description',['demo-v1','synthetic','SHADOWPRINT Phase 2 fixtures','1','Project-authored synthetic records','Nine accounts and 28 original comments. No public dataset imported.']);
 insert('provenance','id,kind,name,version,license_text,description',['scaffold-v1','synthetic','Relational scaffolding','1','Project-authored synthetic records','Posts added for relational integrity; original frontend has no posts.']);
 insert('provenance','id,kind,name,version,license_text,description',['generated-v1','synthetic','Seeded workload','1','Project-authored synthetic records',`LCG seed=${seed>>>0}; extra harmless comments=${extra}; authored scenario templates.`]);
 for(const p of profiles) insert('accounts','id,handle,created_at,bio,provenance_id,source_record_id',[p.id,p.handle,date(p.created),p.bio,'demo-v1',p.id]);
 for(const p of profiles) insert('posts','id,author_id,body,created_at,provenance_id',[`P-${p.id}`,p.id,'Synthetic thread scaffold','2026-10-01 00:00:00','scaffold-v1']);
 const labels=[...new Set(comments.filter(c=>c.category!=='Unflagged').map(c=>c.category))];
 for(const label of labels) insert('label_types','code,description',[label,`Supplied annotation: ${label}; not a model prediction.`]);
 const addComment=(c:{id:string,accountId:string,targetId:string,text:string,at:string,category:string,source:string},provenance:string)=>{
 insert('comments','id,author_id,target_id,post_id,body,created_at,provenance_id,source_record_id',[c.id,c.accountId,c.targetId,`P-${c.targetId}`,c.text,date(c.at),provenance,c.id]);
 if(c.category!=='Unflagged') insert('comment_labels','comment_id,label_code,provenance_id,label_method',[c.id,c.category,provenance,c.source]);
 insert('evidence','id,comment_id',[`E-${c.id}`,c.id]);
 };
 for(const c of comments) addComment(c,'demo-v1');
 for(const d of devices) insert('devices','id,display_name,context,provenance_id',[d.id,d.name,d.context,'demo-v1']);
 for(const l of logins){insert('login_events','id,account_id,device_id,occurred_at,provenance_id',[l.id,l.accountId,l.deviceId,date(l.at),'demo-v1']);insert('evidence','id,login_id',[`E-${l.id}`,l.id]);}
 insert('investigators','id,display_name',['DEMO-ANALYST','Fictional analyst (not an authenticated user)']);
 for(const c of initialCases){
 insert('investigations','id,title,description,status,decision,updated_at',[c.id,c.title,c.description,c.status,c.decision,date(c.updatedAt)]);
 for(const id of c.accountIds) insert('investigation_accounts','investigation_id,account_id',[c.id,id]);
 for(const id of c.commentIds) insert('investigation_evidence','investigation_id,evidence_id',[c.id,`E-${id}`]);
 c.notes.forEach((n,i)=>insert('case_notes','id,investigation_id,investigator_id,body,created_at',[`${c.id}-N${i}`,c.id,'DEMO-ANALYST',n.text,date(n.at)]));
 }
 for(const r of [['REP-01',5,1800,25,'Same author and normalized text'],['TARGET-01',6,86400,25,'Supplied harassment labels to same target'],['COORD-01',3,90,30,'Distinct accounts, same text and target'],['THREAT-01',1,1,20,'Supplied threat label; context required']]) insert('detection_rules','code,version,min_count,window_seconds,weight,description',[r[0],1,r[1],r[2],r[3],r[4]]);
 if(extra){
 const count=Math.max(12,Math.ceil(extra/20));
 for(let i=0;i<count;i++){
 const id=`G-${i}`;insert('accounts','id,handle,created_at,bio,provenance_id,source_record_id',[id,`synthetic_${i}`,'2026-01-01 00:00:00','Generated fictional account','generated-v1',id]);
 }
 let n=0; const generated=(author:string,text:string,category='Unflagged',offset=0)=>addComment({id:`GC-${n++}`,accountId:author,targetId:'U-021',text,at:new Date(Date.UTC(2026,10,1)+offset*1000).toISOString(),category,source:category==='Spam'||category==='Coordinated targeting'?'Rule example':'Authored label'},'generated-v1');
 for(let i=0;i<extra;i++) generated(`G-${6+Math.floor(random()*(count-6))}`,`Harmless fictional message ${i}: ${Math.floor(random()*1000000)}`,'Unflagged',i*120);
 for(let i=0;i<8;i++) generated('G-0','Synthetic promotion repeated','Spam',i*60);
 for(let i=0;i<6;i++) generated('G-1',`Redacted fictional targeting example ${i}`,'Repeated harassment',i*3600);
 generated('G-2','[Redacted synthetic threat-label example]','Threat-related language',60);
 for(let i=0;i<3;i++) generated(`G-${3+i}`,'Synthetic synchronized reply','Coordinated targeting',i*20);
 insert('interactions','id,actor_id,post_id,kind,occurred_at,provenance_id',['GI-1','G-6','P-U-021','like','2026-11-01 00:00:00','generated-v1']);
 }
 lines.push('COMMIT;');return lines.join('\n')+'\n';
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const extra=Number(process.argv[2]??0), seed=Number(process.argv[3]??42);
 if(!Number.isInteger(seed))throw Error('seed must be integer');
 const output=process.argv[4]??fileURLToPath(new URL(extra?'generated.sql':'003_seed.sql',import.meta.url));
 writeFileSync(output,generate(extra,seed));console.log(`Generated ${output}: 9 original accounts, 28 original comments; ${extra} harmless + ${extra?18:0} scenario comments added.`);
}
