import {readFile} from 'node:fs/promises';
export function statements(sql){
 let delimiter=';',buffer='',out=[];
 for(const line of sql.split(/\r?\n/)){
  if(line.trim().startsWith('--')||!line.trim())continue;
  if(/^DELIMITER /i.test(line)){if(buffer.trim())throw Error('Unexpected delimiter');delimiter=line.trim().split(/\s+/)[1];continue;}
  buffer+=line+'\n';
  if(buffer.trimEnd().endsWith(delimiter)){out.push(buffer.trimEnd().slice(0,-delimiter.length));buffer='';}
 }
 if(buffer.trim())throw Error('Unterminated SQL');return out;
}
export async function apply(db,file){for(const sql of statements(await readFile(new URL(file,import.meta.url),'utf8')))await db.query(sql);}
export async function connect(){
 if(!process.env.MYSQL_DATABASE)throw Error('Set MYSQL_DATABASE to an existing dedicated empty schema. No database is created/dropped automatically.');
 const mysql=await import('mysql2/promise');
 const db=await mysql.createConnection({host:process.env.MYSQL_HOST??'127.0.0.1',port:Number(process.env.MYSQL_PORT??3306),user:process.env.MYSQL_USER??'root',password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,charset:'utf8mb4',timezone:'Z',connectTimeout:10000});
 const [[{version}]]=await db.query('SELECT VERSION() AS version');
 const [major,minor,patch]=version.split('.').map(Number);
 if(/MariaDB/i.test(version)||major<8||(major===8&&minor===0&&patch<16)){await db.end();throw Error(`Unsupported MySQL version: ${version}`);}
 await db.query("SET time_zone='+00:00'");
 await db.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION'");
 return db;
}
