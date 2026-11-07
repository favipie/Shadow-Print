"""Create ignored local server settings without printing the generated service key."""

import argparse
import secrets
from pathlib import Path

from sqlalchemy.engine import URL

parser = argparse.ArgumentParser()
parser.add_argument("--server", required=True)
parser.add_argument("--database", default="shadowprint_db")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
targets = [root / "backend" / ".env", root / ".env.local"]
if any(p.exists() for p in targets):
    raise SystemExit(
        "Existing local settings were preserved. Edit backend/.env and .env.local manually."
    )
key = secrets.token_urlsafe(48)
url = URL.create(
    "mssql+pyodbc",
    host=args.server,
    database=args.database,
    query={
        "driver": "ODBC Driver 18 for SQL Server",
        "TrustServerCertificate": "yes",
        "LongAsMax": "yes",
    },
)
targets[0].write_text(
    f"SHADOWPRINT_DATABASE_URL={url.render_as_string(hide_password=False)}\nSHADOWPRINT_API_KEY={key}\nSHADOWPRINT_INVESTIGATOR_ID=DEMO-ANALYST\n",
    encoding="utf-8",
)
targets[1].write_text(
    f"SHADOWPRINT_API_URL=http://127.0.0.1:8000\nSHADOWPRINT_API_KEY={key}\n", encoding="utf-8"
)
print(
    "Created ignored backend/.env and .env.local with a shared server-only key. No database changes."
)
