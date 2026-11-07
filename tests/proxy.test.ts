import test from "node:test";
import assert from "node:assert/strict";
import {
  localRequestAllowed,
  apiPathAllowed,
  localBackend,
} from "../src/lib/proxy-policy";
test("server boundary rejects foreign origins, hosts, and cross-site fetches", () => {
  assert.equal(
    localRequestAllowed(
      new Request("http://localhost:3000/api/backend/cases", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
    true,
  );
  assert.equal(
    localRequestAllowed(
      new Request("http://127.0.0.1:3000/api/backend/cases", {
        headers: { origin: "http://127.0.0.1:3000" },
      }),
    ),
    true,
  );
  const rejectedHeaders: Record<string, string>[] = [
    { origin: "https://evil.example" },
    { host: "evil.example" },
    { "sec-fetch-site": "cross-site" },
  ];
  for (const headers of rejectedHeaders)
    assert.equal(
      localRequestAllowed(
        new Request("http://127.0.0.1:3000/api/backend/cases", {
          headers,
        }),
      ),
      false,
    );
  assert.equal(
    localRequestAllowed(new Request("http://evil.example/api/backend/cases")),
    false,
  );
});
test("server boundary only forwards known operations and loopback upstreams", () => {
  assert.equal(apiPathAllowed("POST", "cases"), true);
  assert.equal(apiPathAllowed("GET", "findings/abc/evidence"), true);
  assert.equal(apiPathAllowed("GET", "legacy/api/reports/SP-1"), true);
  assert.equal(apiPathAllowed("PATCH", "legacy/api/cases/SP-1/status"), true);
  assert.equal(apiPathAllowed("GET", "legacy/api/../health"), false);
  for (const path of [
    "../health",
    "cases/../../docs",
    "https://evil.example",
    "cases/%2e%2e",
  ])
    assert.equal(apiPathAllowed("GET", path), false);
  assert.equal(apiPathAllowed("DELETE", "cases/SP-1"), false);
  assert.equal(localBackend("http://127.0.0.1:8000"), "http://127.0.0.1:8000");
  for (const url of [
    "https://evil.example",
    "http://user:password@localhost:8000",
    "http://localhost:8000/path",
  ])
    assert.throws(() => localBackend(url));
});
