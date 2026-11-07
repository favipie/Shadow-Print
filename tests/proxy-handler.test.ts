import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/backend/[...path]/route";

test("proxy injects a server key, rejects foreign origins, and forwards errors", async () => {
  const key = "test-only-key-" + "x".repeat(32);
  const previousKey = process.env.SHADOWPRINT_API_KEY;
  const previousFetch = globalThis.fetch;
  const context = { params: Promise.resolve({ path: ["accounts"] }) };
  const local = () =>
    new Request("http://localhost:3000/api/backend/accounts", {
      headers: { host: "localhost:3000" },
    });
  try {
    process.env.SHADOWPRINT_API_KEY = key;
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        `Bearer ${key}`,
      );
      return new Response(JSON.stringify({ detail: "Backend unavailable" }), {
        status: 503,
      });
    };
    const denied = await GET(
      new Request("http://localhost:3000/api/backend/accounts", {
        headers: { origin: "https://evil.example" },
      }),
      context,
    );
    assert.equal(denied.status, 403);
    assert.equal(calls, 0);
    const result = await GET(local(), context);
    assert.equal(result.status, 503);
    assert.equal((await result.text()).includes(key), false);
    assert.equal(calls, 1);
    globalThis.fetch = async (url, init) => {
      assert.equal(
        String(url),
        "http://127.0.0.1:8000/api/reports/SP-1?format=csv",
      );
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        `Bearer ${key}`,
      );
      assert.equal(
        new Headers(init?.headers).get("x-shadowprint-client"),
        "local-workspace",
      );
      return new Response("case,content", {
        headers: {
          "content-type": "text/csv",
          "content-disposition": "attachment; filename=report.csv",
        },
      });
    };
    const report = await GET(
      new Request(
        "http://localhost:3000/api/backend/legacy/api/reports/SP-1?format=csv",
      ),
      {
        params: Promise.resolve({ path: ["legacy", "api", "reports", "SP-1"] }),
      },
    );
    assert.equal(report.headers.get("content-type"), "text/csv");
    assert.equal(
      report.headers.get("content-disposition"),
      "attachment; filename=report.csv",
    );
    globalThis.fetch = async () =>
      new Response('{"detail":"Unauthorized"}', {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    assert.equal((await GET(local(), context)).status, 401);
    delete process.env.SHADOWPRINT_API_KEY;
    assert.equal((await GET(local(), context)).status, 503);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.SHADOWPRINT_API_KEY;
    else process.env.SHADOWPRINT_API_KEY = previousKey;
  }
});
