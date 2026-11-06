const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
export function localRequestAllowed(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  try {
    // Next may normalize the internal URL to localhost while preserving the
    // browser's 127.0.0.1 Host. Validate both, then compare Origin to actual Host.
    const received = new URL(`${url.protocol}//${host ?? url.host}`);
    return (
      loopback.has(url.hostname) &&
      loopback.has(received.hostname) &&
      !received.username &&
      !received.password &&
      received.pathname === "/" &&
      received.port === url.port &&
      (!origin || origin === received.origin) &&
      request.headers.get("sec-fetch-site") !== "cross-site"
    );
  } catch {
    return false;
  }
}
export function apiPathAllowed(method: string, path: string) {
  const id = "[A-Za-z0-9_-]{1,64}";
  const paths =
    method === "GET"
      ? [
          "accounts",
          `accounts/${id}`,
          `accounts/${id}/(logins|findings|related)`,
          "comments",
          `comments/${id}`,
          "overview",
          "provenance",
          "rules",
          "network",
          "coordination",
          `coordination/${id}/comments`,
          `evidence/${id}`,
          "detection-runs",
          `detection-runs/${id}/findings`,
          `findings/${id}`,
          "cases",
          `cases/${id}`,
          `cases/${id}/(notes|report)`,
          "audit",
          "settings",
        ]
      : method === "POST"
        ? [
            "cases",
            `cases/${id}/notes`,
            `comments/${id}/reviews`,
            "detection-runs",
          ]
        : method === "PUT"
          ? [`cases/${id}`]
          : [];
  if (method === "GET") paths.push(`findings/${id}/evidence`);
  return paths.some((pattern) => new RegExp(`^(?:${pattern})$`).test(path));
}
export function localBackend(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !loopback.has(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("A local HTTP backend origin is required");
  return url.origin;
}
