/** Bound public intake requests before parsing; never log submitted fields. */
export async function readContactRequest(request: Request): Promise<
  { ok: true; body: unknown } | { ok: false; status: number }
> {
  if (request.headers.get("sec-fetch-site") === "cross-site") return { ok: false, status: 403 };
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return { ok: false, status: 403 };
    } catch { return { ok: false, status: 403 }; }
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, status: 415 };
  }
  const limit = 16 * 1024;
  if (Number(request.headers.get("content-length")) > limit) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, body: JSON.parse(text) };
  } catch { return { ok: false, status: 400 }; }
  finally { reader.releaseLock(); }
}
