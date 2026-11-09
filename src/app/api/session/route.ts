import { NextResponse } from "next/server";
import {
  hosted,
  hostedRequestAllowed,
  sessionCookie,
  sessionFromRequest,
  sessionRequest,
} from "@/lib/hosted";
import { readJsonBody } from "@/lib/json-body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (detail: string, status: number) =>
  NextResponse.json(
    { detail },
    { status, headers: { "Cache-Control": "no-store" } },
  );
const options = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
};

export async function POST(request: Request) {
  if (!hosted() || !hostedRequestAllowed(request))
    return reply("Access denied", 403);
  const body = await readJsonBody(request, 4096);
  if (body instanceof Response) return body;
  try {
    const upstream = await sessionRequest("POST", undefined, body);
    if (!upstream.ok)
      return reply(
        upstream.status === 401 ? "Invalid credentials" : "Sign-in unavailable",
        upstream.status,
      );
    const data = await upstream.json();
    if (
      typeof data.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.token)
    )
      return reply("Sign-in unavailable", 503);
    const response = reply("Signed in", 200);
    response.cookies.set(sessionCookie, data.token, {
      ...options,
      maxAge: 3600,
    });
    return response;
  } catch {
    return reply("Sign-in unavailable", 503);
  }
}

export async function DELETE(request: Request) {
  if (!hosted() || !hostedRequestAllowed(request))
    return reply("Access denied", 403);
  try {
    const token = sessionFromRequest(request);
    if (token) {
      const upstream = await sessionRequest("DELETE", token);
      if (!upstream.ok && upstream.status !== 401)
        return reply("Sign-out unavailable", 503);
    }
    const response = reply("Signed out", 200);
    response.cookies.set(sessionCookie, "", { ...options, maxAge: 0 });
    return response;
  } catch {
    return reply("Sign-out unavailable", 503);
  }
}
