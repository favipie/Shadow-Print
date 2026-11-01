import {connect,apply} from './sql-runner.mjs';
const db=await connect();
try{
 const [tables]=await db.query('SHOW TABLES');
 if(tables.length)throw Error('Refusing non-empty schema. Migrations are one-time; DDL is not transactional. Use a fresh dedicated schema after partial failure.');
 for(const file of ['001_schema.sql','002_detection.sql','003_seed.sql']){await apply(db,file);console.log(`Applied ${file}`);}
 console.log('Schema and deterministic seed installed. Run node verify.mjs.');
}finally{await db.end();}
