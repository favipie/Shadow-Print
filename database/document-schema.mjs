import {readFileSync,writeFileSync} from 'node:fs';
const ddl=readFileSync(new URL('001_schema.sql',import.meta.url),'utf8');
const tables=[...ddl.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\) ENGINE=InnoDB;/g)];
let dictionary='# Data dictionary\n\nGenerated from 001_schema.sql by document-schema.mjs. SQL definitions below are the authoritative field-level types, nullability, keys, constraints and indexes. IDs are stable opaque strings (64 characters), timestamps are UTC DATETIME(3), and all foreign-key deletion behavior is RESTRICT by default. AUTO_INCREMENT IDs are local event ordering keys.\n';
let er='# Entity relationships\n\nEvery line below is backed by an actual foreign key in 001_schema.sql. Junction tables implement many-to-many associations. Device connections are observations, not identities.\n\n```mermaid\nerDiagram\n';
for(const [,name,body] of tables){
 dictionary+=`\n## ${name}\n\n\`\`\`sql\n${body.trim()}\n\`\`\`\n`;
 const first=body.trim().match(/^(\w+)\s+(\w+)/);
 er+=`    ${name} {\n        ${first[2].toLowerCase()} ${first[1]} "First key column; full definition in dictionary"\n    }\n`;
 for(const fk of body.matchAll(/FOREIGN KEY\s*\(([^)]+)\) REFERENCES (\w+)\(([^)]+)\)/g))
 er+=`    ${fk[2]} ||--o{ ${name} : "${fk[1]}"\n`;
}
er+='```\n\nThe optional evidence source keys use a CHECK enforcing exactly one source. Optional audit targets likewise require exactly one case or review action. Mermaid shows the general parent-to-child relationship; consult field nullability for optional edges.\n';
writeFileSync(new URL('DATA-DICTIONARY.md',import.meta.url),dictionary);
writeFileSync(new URL('ER.md',import.meta.url),er);
console.log(`Documented ${tables.length} tables.`);
