"""Invitation-only sessions for one shared synthetic workspace, one API worker."""

import hashlib
import hmac
import json
import logging
import re
import secrets
import time
from collections import deque
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path

from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse

actor_id = ContextVar("shadowprint_actor_id", default=None)
log = logging.getLogger("uvicorn.error")
SESSION_TTL = 3600
MAX_BODY = 100_000


def derive(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode(), salt=salt, n=32768, r=8, p=1, dklen=32, maxmem=64 * 1024 * 1024
    )


@dataclass(frozen=True)
class Member:
    actor: str
    role: str
    salt: bytes
    digest: bytes


def load_members(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not 1 <= len(data) <= 32:
        raise ValueError("Configure 1 to 32 demo invitations")
    members = {}
    for login, values in data.items():
        member = Member(
            values["actor"],
            values["role"],
            bytes.fromhex(values["salt"]),
            bytes.fromhex(values["digest"]),
        )
        if (
            not re.fullmatch(r"[a-z0-9_-]{1,32}", login)
            or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", member.actor)
            or member.role not in {"viewer", "investigator", "admin"}
            or len(member.salt) != 16
            or len(member.digest) != 32
            or any(m.actor == member.actor for m in members.values())
        ):
            raise ValueError("Invalid or duplicate invitation")
        members[login] = member
    return members


class Window:
    """Single event-loop sliding limit. Call only from the ASGI event loop."""

    def __init__(self, count):
        self.count = count
        self.events = deque()

    def allow(self, now):
        while self.events and self.events[0] <= now - 60:
            self.events.popleft()
        if len(self.events) >= self.count:
            return False
        self.events.append(now)
        return True


def allowed(role, method, path):
    if method == "GET":
        return True  # All invited members share this one synthetic workspace.
    if method == "POST" and path in {"/api/v1/detection-runs", "/api/detection/runs"}:
        return role == "admin"
    if role not in {"investigator", "admin"}:
        return False
    return any(
        m == method and re.fullmatch(pattern, path)
        for m, pattern in (
            ("POST", r"/api(?:/v1)?/cases"),
            ("PUT", r"/api(?:/v1)?/cases/[A-Za-z0-9_-]+"),
            ("POST", r"/api(?:/v1)?/cases/[A-Za-z0-9_-]+/notes"),
            ("PATCH", r"/api/cases/[A-Za-z0-9_-]+/status"),
            ("POST", r"/api/v1/comments/[A-Za-z0-9_-]+/reviews"),
            ("POST", r"/api/comments/[A-Za-z0-9_-]+/review"),
        )
    )


class HostedBoundary:
    def __init__(self, app, service_key, members):
        self.app, self.service_key, self.members = app, service_key.encode(), members
        self.sessions = {}  # Only token digests in memory. Restart revokes all sessions.
        self.global_rate, self.login_rate = Window(1200), Window(20)
        self.actor_rates = {m.actor: Window(240) for m in members.values()}
        self.dummy = Member("", "", secrets.token_bytes(16), secrets.token_bytes(32))

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request = Request(scope, receive)
        path, method = scope["path"], scope["method"]
        now = time.monotonic()

        async def reply(status, data):
            await JSONResponse(data, status_code=status, headers={"Cache-Control": "no-store"})(
                scope, receive, send
            )

        if not self.global_rate.allow(now):
            return await reply(429, {"detail": "Too many requests"})
        if method == "GET" and path == "/health/live":
            return await self.app(scope, receive, send)
        supplied = request.headers.get("authorization", "").encode()
        if not hmac.compare_digest(supplied, b"Bearer " + self.service_key):
            return await reply(401, {"detail": "Unauthorized"})
        if method == "GET" and path == "/health/ready":
            return await self.app(scope, receive, send)

        for key, (_, expires) in list(self.sessions.items()):
            if expires <= now:
                del self.sessions[key]
        login = (method, path) == ("POST", "/session/login")
        raw_token = request.headers.get("x-shadowprint-session", "")
        key = hashlib.sha256(raw_token.encode()).digest()
        session = self.sessions.get(key)
        if not login and not session:
            return await reply(401, {"detail": "Sign in required"})
        if login and not self.login_rate.allow(now):
            return await reply(429, {"detail": "Too many sign-in attempts"})
        if session and not self.actor_rates[session[0].actor].allow(now):
            return await reply(429, {"detail": "Too many requests"})
        if (method, path) == ("DELETE", "/session"):
            del self.sessions[key]
            return await reply(200, {"signed_out": True})
        if (method, path) == ("GET", "/session"):
            return await reply(200, {"investigator": session[0].actor, "role": session[0].role})
        if not login and (
            not path.startswith("/api/") or not allowed(session[0].role, method, path)
        ):
            return await reply(403, {"detail": "Operation not allowed"})
        # Enforce the byte limit before handing arbitrary bodies to FastAPI.
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > (4096 if login else MAX_BODY):
                return await reply(413, {"detail": "Request too large"})
            body.extend(chunk)
        if login:
            try:
                fields = json.loads(body)
                username, password = fields["username"], fields["password"]
                if (
                    not isinstance(username, str)
                    or not isinstance(password, str)
                    or len(password) > 256
                ):
                    raise ValueError()
                password.encode("utf-8")
            except (TypeError, KeyError, ValueError):
                return await reply(400, {"detail": "Invalid sign-in request"})
            member = self.members.get(username, self.dummy)
            attempt = await run_in_threadpool(derive, password, member.salt)
            if not hmac.compare_digest(attempt, member.digest) or member is self.dummy:
                return await reply(401, {"detail": "Invalid credentials"})
            # One live session per invitation bounds memory and revokes old logins.
            for prior, (owner, _) in list(self.sessions.items()):
                if owner == member:
                    del self.sessions[prior]
            token = secrets.token_urlsafe(32)
            self.sessions[hashlib.sha256(token.encode()).digest()] = (
                member,
                time.monotonic() + SESSION_TTL,
            )
            return await reply(200, {"token": token, "expires_in": SESSION_TTL})

        replay = True

        async def read():
            nonlocal replay
            if replay:
                replay = False
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        marker = actor_id.set(session[0].actor)
        try:
            await self.app(scope, read, send)
            if method != "GET":
                # No request body, query string, credentials or unvalidated user-supplied ID.
                log.info(
                    "investigator=%s method=%s route=%s",
                    session[0].actor,
                    method,
                    getattr(scope.get("route"), "path", "workspace"),
                )
        finally:
            actor_id.reset(marker)
