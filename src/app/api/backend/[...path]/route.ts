import {
  apiPathAllowed,
  localBackend,
  localRequestAllowed,
} from "@/lib/proxy-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
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
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return Response.json(
        { detail: "JSON request required" },
        { status: 415 },
      );
    body = await request.text();
    if (body.length > 100_000)
      return Response.json({ detail: "Request too large" }, { status: 413 });
    try {
      JSON.parse(body);
    } catch {
      return Response.json({ detail: "Invalid JSON" }, { status: 400 });
    }
  }
  try {
    const origin = localBackend(
      process.env.SHADOWPRINT_API_URL ?? "http://127.0.0.1:8000",
    );
    const upstream = await fetch(
      `${origin}/api/v1/${path}${new URL(request.url).search}`,
      {
        method: request.method,
        body,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(35_000),
      },
    );
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
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
