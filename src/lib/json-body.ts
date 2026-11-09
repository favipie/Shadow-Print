export async function readJsonBody(
  request: Request,
  maxBodyBytes = 100_000,
): Promise<string | Response> {
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
