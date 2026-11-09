import {
  hosted,
  hostedRequestAllowed,
  secureOrigin,
  sessionFromRequest,
} from "@/lib/hosted";
import { readJsonBody } from "@/lib/json-body";
import {
  apiPathAllowed,
  localBackend,
  localRequestAllowed,
} from "@/lib/proxy-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function forward(request: Request, context: Context) {
  const cloud = hosted();
  if (!(cloud ? hostedRequestAllowed(request) : localRequestAllowed(request)))
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
  const session = cloud ? sessionFromRequest(request) : undefined;
  if (cloud && !session)
    return Response.json({ detail: "Sign in required" }, { status: 401 });
  let body: string | undefined;
  if (request.method !== "GET") {
    const payload = await readJsonBody(request);
    if (payload instanceof Response) return payload;
    body = payload;
  }
  try {
    const origin = cloud
      ? secureOrigin(process.env.SHADOWPRINT_API_URL)
      : localBackend(
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
          ...(session ? { "X-Shadowprint-Session": session } : {}),
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
