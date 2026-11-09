import test from "node:test";
import assert from "node:assert/strict";
import { POST as login, DELETE as logout } from "../src/app/api/session/route";
import { POST as proxy } from "../src/app/api/backend/[...path]/route";
import { sessionCookie } from "../src/lib/hosted";

test("hosted sign-in uses a private cookie; proxy rejects CSRF and spoofed identity", async () => {
  const previous = process.env;
  const origFetch = globalThis.fetch;
  const token = "a".repeat(43),
    origin = "https://demo.example.org";
  process.env = {
    ...previous,
    SHADOWPRINT_MODE: "hosted",
    SHADOWPRINT_PUBLIC_ORIGIN: origin,
    SHADOWPRINT_API_URL: "https://api.example.org",
    SHADOWPRINT_API_KEY: "x".repeat(48),
  };
  const req = (path: string, headers: Record<string, string> = {}) =>
    new Request(origin + path, {
      method: "POST",
      headers: {
        origin,
        host: "demo.example.org",
        "content-type": "application/json",
        ...headers,
      },
      body: "{}",
    });
  try {
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), "https://api.example.org/session/login");
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer " + "x".repeat(48),
      );
      return Response.json({ token, expires_in: 3600 });
    };
    const cookie = (await login(req("/api/session"))).headers.get(
      "set-cookie",
    )!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=strict/i);
    const ctx = { params: Promise.resolve({ path: ["cases"] }) };
    assert.equal((await proxy(req("/api/backend/cases"), ctx)).status, 401);
    assert.equal(
      (
        await proxy(
          req("/api/backend/cases", { origin: "https://evil.example.org" }),
          ctx,
        )
      ).status,
      403,
    );
    assert.equal(calls, 1);
    globalThis.fetch = async (url, init) => {
      const h = new Headers(init?.headers);
      assert.equal(h.get("x-shadowprint-session"), token);
      assert.equal(h.get("x-shadowprint-actor"), null);
      assert.equal(h.get("cookie"), null);
      assert.equal(h.get("authorization"), "Bearer " + "x".repeat(48));
      assert.equal(String(url), "https://api.example.org/api/v1/cases");
      return Response.json(
        { detail: "Operation not allowed" },
        { status: 403 },
      );
    };
    const auth = {
      cookie: sessionCookie + "=" + token,
      "x-shadowprint-session": "spoof",
      "x-shadowprint-actor": "root",
      authorization: "spoof",
    };
    assert.equal(
      (await proxy(req("/api/backend/cases", auth), ctx)).status,
      403,
    );
    globalThis.fetch = async () => Response.json({ signed_out: true });
    assert.match(
      (await logout(req("/api/session", auth))).headers.get("set-cookie")!,
      /Max-Age=0/,
    );
  } finally {
    process.env = previous;
    globalThis.fetch = origFetch;
  }
});
