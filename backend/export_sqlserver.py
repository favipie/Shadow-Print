"""Read-only export of the existing schema and synthetic records. No source DDL/DML."""

import argparse
import hashlib
import json
import re
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import text

from app.config import Settings
from app.db import build_engine


def quote(name):
    return "[" + name.replace("]", "]]") + "]"


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return str(int(value))
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, bytes):
        return "0x" + value.hex()
    if isinstance(value, (date, datetime)):
        value = value.isoformat()
    return "N'" + str(value).replace("'", "''") + "'"


def export(engine, output: Path, digest_only=False):
    output.mkdir(parents=True, exist_ok=True)
    with engine.connect() as conn:

        def query(sql, **params):
            return [dict(row) for row in conn.execute(text(sql), params).mappings()]

        tables = query(
            "SELECT name,object_id FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo') ORDER BY name"
        )
        if len(tables) != 22:
            raise RuntimeError("Expected the verified 22-table schema")
        data = {t["name"]: query(f"SELECT * FROM dbo.{quote(t['name'])}") for t in tables}
        baseline = {}
        for name, values in data.items():
            serialized = sorted(
                json.dumps(row, sort_keys=True, default=str, ensure_ascii=False) for row in values
            )
            baseline[name] = {
                "count": len(values),
                "sha256": hashlib.sha256("\n".join(serialized).encode()).hexdigest(),
            }
        (output / "baseline.json").write_text(
            json.dumps(baseline, indent=2) + "\n", encoding="utf-8"
        )
        if digest_only:
            return
        schema, keys, fks, seeds = [], [], [], []
        dependencies = {t["name"]: set() for t in tables}
        for table in tables:
            name, oid = table["name"], table["object_id"]
            columns = query(
                "SELECT c.name,ty.name AS type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.collation_name,dc.definition AS default_value FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id WHERE c.object_id=:oid ORDER BY c.column_id",
                oid=oid,
            )
            definitions = []
            for col in columns:
                datatype = col["type"]
                if datatype in ("nvarchar", "varchar", "varbinary", "char", "nchar", "binary"):
                    length = col["max_length"]
                    datatype += (
                        "("
                        + (
                            "max"
                            if length == -1
                            else str(length // (2 if col["type"].startswith("n") else 1))
                        )
                        + ")"
                    )
                elif datatype in ("datetime2", "time", "datetimeoffset"):
                    datatype += f"({col['scale']})"
                elif datatype in ("decimal", "numeric"):
                    datatype += f"({col['precision']},{col['scale']})"
                definition = quote(col["name"]) + " " + datatype
                if col["collation_name"]:
                    definition += " COLLATE " + col["collation_name"]
                if col["is_identity"]:
                    identity = query(
                        "SELECT CONVERT(bigint,seed_value) AS seed,CONVERT(bigint,increment_value) AS step FROM sys.identity_columns WHERE object_id=:oid",
                        oid=oid,
                    )[0]
                    definition += f" IDENTITY({identity['seed']},{identity['step']})"
                definition += " NULL" if col["is_nullable"] else " NOT NULL"
                if col["default_value"]:
                    definition += " DEFAULT " + col["default_value"]
                definitions.append(definition)
            schema.append(
                f"CREATE TABLE dbo.{quote(name)} (\n " + ",\n ".join(definitions) + "\n);"
            )
            for idx in query(
                "SELECT * FROM sys.indexes WHERE object_id=:oid AND index_id>0 AND is_hypothetical=0",
                oid=oid,
            ):
                ic = query(
                    "SELECT c.name,ic.is_descending_key,ic.is_included_column FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE ic.object_id=:oid AND ic.index_id=:idx ORDER BY ic.key_ordinal,ic.index_column_id",
                    oid=oid,
                    idx=idx["index_id"],
                )
                cols = ",".join(
                    quote(c["name"]) + (" DESC" if c["is_descending_key"] else "")
                    for c in ic
                    if not c["is_included_column"]
                )
                if idx["is_primary_key"] or idx["is_unique_constraint"]:
                    keys.append(
                        f"ALTER TABLE dbo.{quote(name)} ADD CONSTRAINT {quote(idx['name'])} "
                        + ("PRIMARY KEY " if idx["is_primary_key"] else "UNIQUE ")
                        + idx["type_desc"]
                        + f" ({cols});"
                    )
                else:
                    statement = (
                        "CREATE "
                        + ("UNIQUE " if idx["is_unique"] else "")
                        + idx["type_desc"]
                        + f" INDEX {quote(idx['name'])} ON dbo.{quote(name)} ({cols})"
                    )
                    included = [quote(c["name"]) for c in ic if c["is_included_column"]]
                    if included:
                        statement += " INCLUDE (" + ",".join(included) + ")"
                    if idx["filter_definition"]:
                        statement += " WHERE " + idx["filter_definition"]
                    keys.append(statement + ";")
            for check in query(
                "SELECT name,definition FROM sys.check_constraints WHERE parent_object_id=:oid",
                oid=oid,
            ):
                keys.append(
                    f"ALTER TABLE dbo.{quote(name)} ADD CONSTRAINT {quote(check['name'])} CHECK {check['definition']};"
                )
            for fk in query(
                "SELECT name,object_id,OBJECT_NAME(referenced_object_id) AS target,delete_referential_action_desc AS on_delete,update_referential_action_desc AS on_update FROM sys.foreign_keys WHERE parent_object_id=:oid",
                oid=oid,
            ):
                fc = query(
                    "SELECT COL_NAME(parent_object_id,parent_column_id) AS source,COL_NAME(referenced_object_id,referenced_column_id) AS target FROM sys.foreign_key_columns WHERE constraint_object_id=:oid ORDER BY constraint_column_id",
                    oid=fk["object_id"],
                )
                dependencies[name].add(fk["target"])
                fks.append(
                    f"ALTER TABLE dbo.{quote(name)} ADD CONSTRAINT {quote(fk['name'])} FOREIGN KEY ("
                    + ",".join(quote(c["source"]) for c in fc)
                    + f") REFERENCES dbo.{quote(fk['target'])} ("
                    + ",".join(quote(c["target"]) for c in fc)
                    + ") ON DELETE "
                    + fk["on_delete"].replace("_", " ")
                    + " ON UPDATE "
                    + fk["on_update"].replace("_", " ")
                    + ";"
                )
        pending = set(data)
        while pending:
            ready = sorted(t for t in pending if not dependencies[t] & pending)
            if not ready:
                raise RuntimeError("Cyclic seed dependencies")
            for name in ready:
                values = data[name]
                if values:
                    identity = query(
                        "SELECT name FROM sys.identity_columns WHERE object_id=OBJECT_ID(:name)",
                        name="dbo." + name,
                    )
                    if identity:
                        seeds.append(f"SET IDENTITY_INSERT dbo.{quote(name)} ON;")
                    cols = ",".join(quote(c) for c in values[0])
                    for row in sorted(
                        values, key=lambda r: json.dumps(r, sort_keys=True, default=str)
                    ):
                        seeds.append(
                            f"INSERT INTO dbo.{quote(name)} ({cols}) VALUES ("
                            + ",".join(literal(v) for v in row.values())
                            + ");"
                        )
                    if identity:
                        seeds.append(f"SET IDENTITY_INSERT dbo.{quote(name)} OFF;")
                pending.remove(name)
        modules = query(
            "SELECT o.object_id,o.name,o.type,m.definition FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.schema_id=SCHEMA_ID('dbo') AND o.type IN ('V','P','FN','IF','TF') ORDER BY o.create_date,o.object_id"
        )
        definitions = [
            re.sub(
                r"^\s*(CREATE\s+OR\s+ALTER|CREATE|ALTER)\s+",
                "CREATE OR ALTER ",
                m["definition"],
                count=1,
                flags=re.IGNORECASE,
            )
            for m in modules
        ]
        (output / "001_schema.sql").write_text(
            "-- Exported read-only from the verified SQL Server schema. Fresh test databases only.\n"
            + "\nGO\n".join(schema + keys + fks)
            + "\nGO\n",
            encoding="utf-8",
        )
        (output / "002_detection.sql").write_text(
            "\nGO\n".join(definitions) + "\nGO\n", encoding="utf-8"
        )
        (output / "003_seed.sql").write_text(
            "-- Synthetic snapshot; never apply to the populated application database.\nSET XACT_ABORT ON;\nBEGIN TRANSACTION;\n"
            + "\n".join(seeds)
            + "\nCOMMIT;\nGO\n",
            encoding="utf-8",
        )
        print(
            "Exported 22 tables,",
            len(modules),
            "modules, and",
            sum(len(v) for v in data.values()),
            "rows; source was read-only",
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--digest-only", action="store_true")
    args = parser.parse_args()
    engine = build_engine(Settings())
    if engine is None:
        raise SystemExit("Set SHADOWPRINT_DATABASE_URL")
    try:
        export(engine, args.output, args.digest_only)
    finally:
        engine.dispose()
