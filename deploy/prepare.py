"""Generate private files on the demo host; does not contact a cloud service."""

import argparse
import hashlib
import json
import os
import re
import secrets
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent


def generate(api_domain, app_origin):
    if not re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)+", api_domain):
        raise ValueError("Use a public DNS name for HTTPS")
    if not re.fullmatch(r"https://[a-z0-9-]+(?:\.[a-z0-9-]+)+", app_origin):
        raise ValueError("Use the exact HTTPS frontend origin with no trailing slash")
    target = HERE / ".private"
    if target.exists():
        raise SystemExit("Existing settings preserved")
    os.umask(0o077)
    with tempfile.TemporaryDirectory(dir=HERE) as tmp:
        out = Path(tmp) / "config"
        out.mkdir()

        def save(name, value):
            (out / name).write_text(value + "\n", encoding="utf-8")

        def ssl(*args):
            return subprocess.check_output(
                ["openssl", *args], cwd=out, stderr=subprocess.DEVNULL, text=True
            ).strip()

        ssl(
            "req",
            "-x509",
            "-newkey",
            "rsa:3072",
            "-nodes",
            "-days",
            "365",
            "-keyout",
            "ca.key",
            "-out",
            "ca.crt",
            "-subj",
            "/CN=SHADOWPRINT demo SQL CA",
            "-addext",
            "basicConstraints=critical,CA:TRUE",
        )
        ssl(
            "req",
            "-new",
            "-newkey",
            "rsa:3072",
            "-nodes",
            "-keyout",
            "db.key",
            "-out",
            "db.csr",
            "-subj",
            "/CN=db",
        )
        save(
            "extensions",
            "subjectAltName=DNS:db\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE",
        )
        ssl(
            "x509",
            "-req",
            "-in",
            "db.csr",
            "-CA",
            "ca.crt",
            "-CAkey",
            "ca.key",
            "-CAcreateserial",
            "-out",
            "db.crt",
            "-days",
            "180",
            "-extfile",
            "extensions",
        )
        ca_hash = ssl("x509", "-noout", "-subject_hash", "-in", "ca.crt")
        # SQL Server's unprivileged container user reads the private key.
        os.chown(out / "db.key", 10001, 10001)
        (out / "db.key").chmod(0o600)
        for f in ["ca.crt", "db.crt"]:
            (out / f).chmod(0o444)
        save(
            "mssql.conf",
            "[network]\ntlscert = /tls/db.crt\ntlskey = /tls/db.key\ntlsprotocols = 1.2\nforceencryption = 1",
        )
        (out / "mssql.conf").chmod(0o444)
        sa = "Aa1!" + secrets.token_urlsafe(36)
        app_password = "Aa1!" + secrets.token_urlsafe(36)
        key = secrets.token_urlsafe(48)
        dsn = (
            "mssql+pyodbc://shadowprint_app:"
            + quote(app_password, safe="")
            + "@db:1433/shadowprint_demo?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no"
        )
        save("sql.env", "MSSQL_SA_PASSWORD=" + sa)
        save("admin.env", "INSTALL_PASSWORD=" + sa + "\nAPP_PASSWORD=" + app_password)
        save(
            "api.env",
            "SHADOWPRINT_MODE=hosted\nSHADOWPRINT_DATABASE_URL="
            + dsn
            + "\nSHADOWPRINT_API_KEY="
            + key
            + "\nSHADOWPRINT_API_HOST="
            + api_domain,
        )
        save("compose.env", "API_DOMAIN=" + api_domain + "\nCA_HASH=" + ca_hash)
        save(
            "vercel.env",
            "SHADOWPRINT_MODE=hosted\nSHADOWPRINT_PUBLIC_ORIGIN="
            + app_origin
            + "\nSHADOWPRINT_API_URL=https://"
            + api_domain
            + "\nSHADOWPRINT_API_KEY="
            + key,
        )
        invites = {}
        delivery = []
        for role in ("viewer", "investigator", "admin"):
            pw = secrets.token_urlsafe(24)
            salt = secrets.token_bytes(16)
            digest = hashlib.scrypt(
                pw.encode(),
                salt=salt,
                n=32768,
                r=8,
                p=1,
                dklen=32,
                maxmem=64 * 1024 * 1024,
            )
            invites[role] = {
                "actor": "DEMO-" + role.upper(),
                "role": role,
                "salt": salt.hex(),
                "digest": digest.hex(),
            }
            delivery.append(role + " " + pw)
        save("members.json", json.dumps(invites))
        (out / "members.json").chmod(0o444)
        save("invitation-delivery.txt", "\n".join(delivery))
        os.rename(out, target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-domain", required=True)
    parser.add_argument("--app-origin", required=True)
    args = parser.parse_args()
    generate(args.api_domain, args.app_origin)
    print("Private configuration prepared. No credentials printed.")
