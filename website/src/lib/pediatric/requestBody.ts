/** Read at most limit UTF-8 bytes, including bodies with no Content-Length. */
export class BodyTooLarge extends Error {}
export async function readBoundedJson(request: Request, limit = 64 * 1024): Promise<unknown> {
  if (!request.body) throw new SyntaxError('JSON body required');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new BodyTooLarge('Body exceeds byte limit'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}
