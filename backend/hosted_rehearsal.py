"""Run the production frontend and hosted authentication over local TLS against an owned SQL database."""

import hashlib
import json
import os
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

from app.hosted import derive
from testing import ROOT, REGISTRY, check_name, create_test_database, drop_test_database


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def serve():
    import uvicorn
    from app import api
    from app.config import Settings
    from app.legacy.config import Settings as SqlSettings
    from app.legacy.db import create_db

    name = check_name(os.environ["REHEARSAL_DATABASE"])
    if (REGISTRY / name).read_text() != name:
        raise ValueError("Unowned rehearsal database")
    # Inject only the connection; keep all hosted authentication and role middleware.
    engine = create_db(SqlSettings(database=name))
    api.build_engine = lambda _: engine
    app = api.create_app(Settings())
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.environ["REHEARSAL_API_PORT"]),
        ssl_keyfile=os.environ["REHEARSAL_KEY"],
        ssl_certfile=os.environ["REHEARSAL_CERT"],
        access_log=False,
        proxy_headers=False,
    )


def rehearse(interactive=False):
    openssl = shutil.which("openssl") or "C:/Program Files/Git/usr/bin/openssl.exe"
    name = create_test_database()
    try:
        with tempfile.TemporaryDirectory(dir=REGISTRY) as tmp:
            folder = Path(tmp)
            cert = folder / "cert.pem"
            key = folder / "key.pem"
            subprocess.run(
                [
                    openssl,
                    "req",
                    "-x509",
                    "-newkey",
                    "rsa:2048",
                    "-nodes",
                    "-days",
                    "1",
                    "-keyout",
                    str(key),
                    "-out",
                    str(cert),
                    "-subj",
                    "/CN=127.0.0.1",
                    "-addext",
                    "subjectAltName=IP:127.0.0.1,DNS:localhost",
                ],
                check=True,
                timeout=20,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            pw = secrets.token_urlsafe(24)
            salt = secrets.token_bytes(16)
            members = folder / "members.json"
            members.write_text(
                json.dumps(
                    {
                        "analyst": {
                            "actor": "DEMO-ANALYST",
                            "role": "investigator",
                            "salt": salt.hex(),
                            "digest": derive(pw, salt).hex(),
                        }
                    }
                )
            )
            api_port = port()
            web_port = port()
            env = dict(
                os.environ,
                SHADOWPRINT_MODE="hosted",
                REHEARSAL_DATABASE=name,
                REHEARSAL_PASSWORD=pw,
                REHEARSAL_CERT=str(cert),
                REHEARSAL_KEY=str(key),
                NODE_EXTRA_CA_CERTS=str(cert),
                REHEARSAL_API_PORT=str(api_port),
                REHEARSAL_WEB_PORT=str(web_port),
                SHADOWPRINT_PUBLIC_ORIGIN=f"https://localhost:{web_port}",
                SHADOWPRINT_API_URL=f"https://127.0.0.1:{api_port}",
                SHADOWPRINT_API_HOST="127.0.0.1",
                SHADOWPRINT_MEMBERS_FILE=str(members),
                SHADOWPRINT_API_KEY=secrets.token_urlsafe(48),
                SHADOWPRINT_DATABASE_URL="mssql+pyodbc://shadowprint_app@db:1433/shadowprint_demo?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no",
            )
            processes = []
            ctx = ssl.create_default_context(cafile=str(cert))
            try:
                for cmd, url in [
                    (
                        [sys.executable, str(Path(__file__).resolve()), "serve"],
                        env["SHADOWPRINT_API_URL"] + "/health/live",
                    ),
                    (
                        ["node", "scripts/rehearsal-web.mjs"],
                        env["SHADOWPRINT_PUBLIC_ORIGIN"] + "/sign-in",
                    ),
                ]:
                    proc = subprocess.Popen(cmd, env=env, cwd=ROOT)
                    processes.append(proc)
                    for _ in range(50):
                        if proc.poll() is not None:
                            raise RuntimeError("Rehearsal server exited")
                        try:
                            with urlopen(url, context=ctx, timeout=2) as r:
                                if r.status == 200:
                                    break
                        except OSError:
                            time.sleep(0.5)
                    else:
                        raise RuntimeError("Rehearsal server unavailable")
                if interactive:
                    invite = folder / "local-invitation.txt"
                    invite.write_text("analyst\n" + pw + "\n", encoding="utf-8")
                    invite.chmod(0o600)
                    print("Disposable demo:", env["SHADOWPRINT_PUBLIC_ORIGIN"], flush=True)
                    print(
                        "Local invitation:",
                        invite,
                        "(removed on exit). Press Ctrl+C to close.",
                        flush=True,
                    )
                    info = {
                        "web": env["SHADOWPRINT_PUBLIC_ORIGIN"],
                        "api": env["SHADOWPRINT_API_URL"],
                        "port": web_port,
                        "certificate_sha256": hashlib.sha256(
                            ssl.PEM_cert_to_DER_cert(cert.read_text())
                        ).hexdigest(),
                    }
                    (folder / "local-demo.json").write_text(json.dumps(info), encoding="utf-8")
                    print("Stop this demo with --stop", web_port, flush=True)
                    while all(p.poll() is None for p in processes):
                        if (folder / "stop").exists():
                            return
                        time.sleep(1)
                    raise RuntimeError("Demo service stopped")
                subprocess.run(
                    [
                        "node",
                        "node_modules/@playwright/test/cli.js",
                        "test",
                        "--config=playwright.hosted.config.ts",
                    ],
                    cwd=ROOT,
                    env=env,
                    check=True,
                    timeout=200,
                )
            finally:
                for p in reversed(processes):
                    if p.poll() is None:
                        p.terminate()
                        try:
                            p.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            p.kill()
                            p.wait()
    finally:
        drop_test_database(name)


if __name__ == "__main__":
    if sys.argv[1:] == ["serve"]:
        serve()
    elif len(sys.argv) == 3 and sys.argv[1] == "--stop":
        port_number = int(sys.argv[2])
        for descriptor in REGISTRY.glob("*/local-demo.json"):
            if json.loads(descriptor.read_text())["port"] == port_number:
                (descriptor.parent / "stop").touch()
                print("Shutdown requested for port", port_number)
                break
        else:
            sys.exit("No managed local demo found on that port")
    elif sys.argv[1:] in ([], ["--demo"]):
        try:
            rehearse(interactive=bool(sys.argv[1:]))
        except KeyboardInterrupt:
            print("Disposable demo closed")
    else:
        sys.exit("Use --demo for an interactive local demonstration")
