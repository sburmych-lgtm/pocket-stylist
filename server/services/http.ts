/**
 * fetch with a hard deadline. Unlike withTimeout (which only races a timer
 * and leaves the underlying request running), this aborts the actual HTTP
 * request so hung upstreams (Google OAuth/Drive, Cloudinary CDN) don't pin
 * sockets or memory.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Compose with any caller-supplied signal.
  const callerSignal = init.signal as AbortSignal | null | undefined;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBufferWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
  maxBytes = 20 * 1024 * 1024,
): Promise<{ response: Response; buffer: Buffer }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.body) return { response, buffer: Buffer.alloc(0) };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response_body_too_large");
        throw new Error("response_body_too_large");
      }
      chunks.push(value);
    }
    return {
      response,
      buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total),
    };
  } finally {
    clearTimeout(timer);
  }
}
