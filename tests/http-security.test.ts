import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { fetchBufferWithTimeout } from "../server/services/http.ts";
import { resolveClientIp } from "../server/middleware/rate-limit.ts";

test("rate limiter trusts the proxy-appended rightmost forwarded address", () => {
  const req = {
    headers: { "x-forwarded-for": "spoofed.example, 203.0.113.7" },
    socket: { remoteAddress: "10.0.0.2" },
  } as unknown as Request;
  assert.equal(resolveClientIp(req), "203.0.113.7");
});

test("bounded response reader rejects chunked bodies above the limit", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200 });
  try {
    await assert.rejects(
      fetchBufferWithTimeout("https://example.test/file", {}, 1_000, 4),
      /response_body_too_large/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
