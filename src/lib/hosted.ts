// Imported only from server components and route handlers.
export const sessionCookie = "__Host-shadowprint";
export const hosted = () =>
  process.env.VERCEL === "1" || process.env.SHADOWPRINT_MODE === "hosted";

export function secureOrigin(value: string | undefined) {
  const url = new URL(value ?? "");
  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    (!url.hostname.includes(".") &&
      (url.hostname !== "localhost" || process.env.VERCEL === "1"))
  )
    throw new Error("Configure an exact public HTTPS origin");
  return url.origin;
}

export function hostedRequestAllowed(request: Request) {
  try {
    const origin = secureOrigin(process.env.SHADOWPRINT_PUBLIC_ORIGIN);
    const supplied = request.headers.get("origin");
    return (
      new URL(request.url).origin === origin &&
      request.headers.get("host") === new URL(origin).host &&
      request.headers.get("sec-fetch-site") !== "cross-site" &&
      (supplied === origin || (request.method === "GET" && !supplied))
    );
  } catch {
    return false;
  }
}

export function sessionFromRequest(request: Request) {
  const match = /(?:^|;\s*)__Host-shadowprint=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
    request.headers.get("cookie") ?? "",
  );
  return match?.[1];
}

export async function sessionRequest(
  method: string,
  token?: string,
  body?: string,
) {
  const key = process.env.SHADOWPRINT_API_KEY;
  if (!key || key.trim().length < 32) throw new Error("Service key missing");
  return fetch(
    secureOrigin(process.env.SHADOWPRINT_API_URL) +
      (method === "POST" ? "/session/login" : "/session"),
    {
      method,
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        ...(token ? { "X-Shadowprint-Session": token } : {}),
      },
    },
  );
}
