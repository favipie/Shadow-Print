import {
  apiPathAllowed,
  localBackend,
  localRequestAllowed,
} from "@/lib/proxy-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const maxBodyBytes = 100_000;

async function readJsonBody(request: Request): Promise<string | Response> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json")
    return Response.json({ detail: "JSON request required" }, { status: 415 });
  const tooLarge = () =>
    Response.json({ detail: "Request too large" }, { status: 413 });
  if (Number(request.headers.get("content-length")) > maxBodyBytes)
    return tooLarge();

  const reader = request.body?.getReader();
  const invalid = () =>
    Response.json({ detail: "Invalid JSON" }, { status: 400 });
  if (!reader) return invalid();
  const bytes = new Uint8Array(maxBodyBytes);
  let used = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (used + chunk.value.byteLength > maxBodyBytes) {
        void reader.cancel().catch(() => {});
        return tooLarge();
      }
      bytes.set(chunk.value, used);
      used += chunk.value.byteLength;
    }
    const body = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(0, used),
    );
    JSON.parse(body);
    return body;
  } catch {
    return invalid();
  } finally {
    reader.releaseLock();
  }
}

async function forward(request: Request, context: Context) {
  if (!localRequestAllowed(request))
    return Response.json(
      { detail: "Local same-origin access only" },
      { status: 403 },
    );
  const path = (await context.params).path.join("/");
  if (!apiPathAllowed(request.method, path))
    return Response.json(
      { detail: "Unsupported API operation" },
      { status: 404 },
    );
  const key = process.env.SHADOWPRINT_API_KEY;
  if (!key)
    return Response.json(
      { detail: "The Next.js server API key is not configured" },
      { status: 503 },
    );
  let body: string | undefined;
  if (request.method !== "GET") {
    const payload = await readJsonBody(request);
    if (payload instanceof Response) return payload;
    body = payload;
  }
  try {
    const origin = localBackend(
      process.env.SHADOWPRINT_API_URL ?? "http://127.0.0.1:8000",
    );
    const legacy = path.startsWith("legacy/api/");
    const upstreamPath = legacy
      ? path.slice("legacy/".length)
      : `api/v1/${path}`;
    const upstream = await fetch(
      `${origin}/${upstreamPath}${new URL(request.url).search}`,
      {
        method: request.method,
        body,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(legacy ? { "X-Shadowprint-Client": "local-workspace" } : {}),
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(35_000),
      },
    );
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        ...(upstream.headers.get("content-disposition")
          ? {
              "Content-Disposition": upstream.headers.get(
                "content-disposition",
              )!,
            }
          : {}),
        ...(upstream.headers.get("content-security-policy")
          ? {
              "Content-Security-Policy": upstream.headers.get(
                "content-security-policy",
              )!,
            }
          : {}),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        detail:
          "FastAPI is unavailable. Check the local backend and SQL Server connection.",
      },
      { status: 503 },
    );
  }
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
