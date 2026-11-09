import os
import uvicorn

if os.environ.get("SHADOWPRINT_MODE") != "hosted":
    raise SystemExit("The cloud image requires hosted authentication")
uvicorn.run(
    "main:app",
    app_dir="/srv/backend",
    host="0.0.0.0",
    port=8000,
    workers=1,
    access_log=False,
    proxy_headers=False,
)
