import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  TEXT_MAX_LENGTH,
  TtsError,
  _resetTtsCache,
  getTtsStatus,
  isTtsElevenLabsEnabled,
  isValidPersona,
  resolvePersonaVoiceIds,
  synthesizeSpeech,
  type StylistPersona,
} from "../server/services/tts.js";
import { ttsRouter } from "../server/api/tts.js";
import { _ratelimitReset } from "../server/middleware/rate-limit.js";

/* ---------- Pure unit tests on the service ---------- */

test("isTtsElevenLabsEnabled is false without ELEVENLABS_API_KEY", () => {
  assert.equal(isTtsElevenLabsEnabled({}), false);
  assert.equal(isTtsElevenLabsEnabled({ ELEVENLABS_API_KEY: "" }), false);
  assert.equal(
    isTtsElevenLabsEnabled({ ELEVENLABS_API_KEY: "YOUR_KEY_HERE" }),
    false,
  );
});

test("isTtsElevenLabsEnabled is true with a real key", () => {
  assert.equal(isTtsElevenLabsEnabled({ ELEVENLABS_API_KEY: "sk_test_xyz" }), true);
});

test("isValidPersona accepts only the four stylist personas", () => {
  assert.equal(isValidPersona("classic"), true);
  assert.equal(isValidPersona("sassy"), true);
  assert.equal(isValidPersona("manly"), true);
  assert.equal(isValidPersona("kind"), true);
  assert.equal(isValidPersona("villain"), false);
  assert.equal(isValidPersona(null), false);
  assert.equal(isValidPersona(undefined), false);
});

test("resolvePersonaVoiceIds returns defaults when no overrides", () => {
  const v = resolvePersonaVoiceIds({});
  assert.equal(v.classic, "21m00Tcm4TlvDq8ikWAM");
  assert.equal(v.sassy, "AZnzlk1XvdvUeBnXmlld");
  assert.equal(v.manly, "ErXwobaYiN019PkySvjV");
  assert.equal(v.kind, "EXAVITQu4vr4xnSDxMaL");
});

test("resolvePersonaVoiceIds honours per-persona env overrides", () => {
  const v = resolvePersonaVoiceIds({
    ELEVENLABS_VOICE_CLASSIC: "custom-classic",
    ELEVENLABS_VOICE_SASSY: "  custom-sassy  ",
    ELEVENLABS_VOICE_MANLY: "YOUR_KEY_HERE", // should NOT override
  });
  assert.equal(v.classic, "custom-classic");
  assert.equal(v.sassy, "custom-sassy");
  assert.equal(v.manly, "ErXwobaYiN019PkySvjV"); // default kept
  assert.equal(v.kind, "EXAVITQu4vr4xnSDxMaL");
});

test("getTtsStatus exposes voices and enabled flag together", () => {
  const s = getTtsStatus({ ELEVENLABS_API_KEY: "sk_test_xyz" });
  assert.equal(s.elevenlabsEnabled, true);
  assert.equal(s.voices.classic, "21m00Tcm4TlvDq8ikWAM");
  const disabled = getTtsStatus({});
  assert.equal(disabled.elevenlabsEnabled, false);
});

test("synthesizeSpeech throws tts_unavailable when key is missing", async () => {
  _resetTtsCache();
  await assert.rejects(
    synthesizeSpeech({ text: "hi", persona: "classic", env: {} }),
    (err: unknown) =>
      err instanceof TtsError && err.code === "tts_unavailable",
  );
});

test("synthesizeSpeech rejects text longer than 800 chars", async () => {
  _resetTtsCache();
  const text = "x".repeat(TEXT_MAX_LENGTH + 1);
  await assert.rejects(
    synthesizeSpeech({
      text,
      persona: "classic",
      env: { ELEVENLABS_API_KEY: "sk_test_xyz" },
    }),
    (err: unknown) => err instanceof TtsError && err.code === "invalid_input",
  );
});

test("synthesizeSpeech rejects empty text", async () => {
  _resetTtsCache();
  await assert.rejects(
    synthesizeSpeech({
      text: "   ",
      persona: "classic",
      env: { ELEVENLABS_API_KEY: "sk_test_xyz" },
    }),
    (err: unknown) => err instanceof TtsError && err.code === "invalid_input",
  );
});

test("synthesizeSpeech caches across calls (no second fetch)", async () => {
  _resetTtsCache();
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls++;
    return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x00]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  };
  const env = { ELEVENLABS_API_KEY: "sk_test_xyz" };
  const first = await synthesizeSpeech({
    text: "Hello",
    persona: "classic",
    fetchImpl: fakeFetch,
    env,
  });
  assert.equal(first.cached, false);
  assert.equal(calls, 1);

  const second = await synthesizeSpeech({
    text: "Hello",
    persona: "classic",
    fetchImpl: fakeFetch,
    env,
  });
  assert.equal(second.cached, true);
  assert.equal(calls, 1, "second call must come from cache");
});

test("synthesizeSpeech surfaces upstream errors as tts_failed", async () => {
  _resetTtsCache();
  const fakeFetch: typeof fetch = async () =>
    new Response("forbidden", { status: 403 });
  await assert.rejects(
    synthesizeSpeech({
      text: "Hi",
      persona: "kind",
      fetchImpl: fakeFetch,
      env: { ELEVENLABS_API_KEY: "sk_test_xyz" },
    }),
    (err: unknown) => err instanceof TtsError && err.code === "tts_failed",
  );
});

/* ---------- HTTP integration tests through the Express router ---------- */

interface ServerHandle {
  url: string;
  close: () => Promise<void>;
}

function startServer(userId = "u-test"): Promise<ServerHandle> {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      // Mock requireAuth — set a deterministic userId so the limiter buckets per-user.
      req.userId = userId;
      next();
    });
    app.use("/api/tts", ttsRouter);
    const server = app.listen(0, () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

test("POST /api/tts returns 503 with browser-fallback flag when key is unset", async () => {
  _resetTtsCache();
  _ratelimitReset();
  const prevKey = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  const srv = await startServer("u-503");
  try {
    const res = await fetch(`${srv.url}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", persona: "classic" }),
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string; useBrowserFallback: boolean };
    assert.equal(body.error, "tts_unavailable");
    assert.equal(body.useBrowserFallback, true);
  } finally {
    if (prevKey !== undefined) process.env.ELEVENLABS_API_KEY = prevKey;
    await srv.close();
  }
});

test("POST /api/tts rejects text longer than 800 chars with 400", async () => {
  _resetTtsCache();
  _ratelimitReset();
  const prevKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = "sk_test_xyz";
  const srv = await startServer("u-toolong");
  try {
    const res = await fetch(`${srv.url}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "x".repeat(TEXT_MAX_LENGTH + 1),
        persona: "classic",
      }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; maxLength: number };
    assert.equal(body.error, "text_too_long");
    assert.equal(body.maxLength, TEXT_MAX_LENGTH);
  } finally {
    if (prevKey !== undefined) process.env.ELEVENLABS_API_KEY = prevKey;
    else delete process.env.ELEVENLABS_API_KEY;
    await srv.close();
  }
});

test("POST /api/tts rate-limits the 16th call within 5 min", async () => {
  _resetTtsCache();
  _ratelimitReset();
  const prevKey = process.env.ELEVENLABS_API_KEY;
  // No key set — every call returns 503 BUT the limiter runs before that check
  // so we can validate burst control without touching the network. 503s still
  // consume a token because the limiter middleware runs first.
  delete process.env.ELEVENLABS_API_KEY;
  const srv = await startServer("u-burst");
  try {
    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${srv.url}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `msg ${i}`, persona: "classic" satisfies StylistPersona }),
      });
      assert.notEqual(res.status, 429, `call ${i + 1} unexpectedly rate-limited`);
      // Drain the body so the socket is freed.
      await res.text();
    }
    const blocked = await fetch(`${srv.url}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "spam", persona: "classic" }),
    });
    assert.equal(blocked.status, 429);
    const body = (await blocked.json()) as { error: string; scope: string };
    assert.equal(body.error, "rate_limit_exceeded");
    assert.equal(body.scope, "tts");
  } finally {
    if (prevKey !== undefined) process.env.ELEVENLABS_API_KEY = prevKey;
    await srv.close();
  }
});

test("GET /api/tts/status reports voices + enabled flag", async () => {
  const prevKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = "sk_test_xyz";
  const srv = await startServer();
  try {
    const res = await fetch(`${srv.url}/api/tts/status`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      elevenlabsEnabled: boolean;
      voices: Record<string, string>;
    };
    assert.equal(body.elevenlabsEnabled, true);
    assert.ok(body.voices.classic);
    assert.ok(body.voices.sassy);
    assert.ok(body.voices.manly);
    assert.ok(body.voices.kind);
  } finally {
    if (prevKey !== undefined) process.env.ELEVENLABS_API_KEY = prevKey;
    else delete process.env.ELEVENLABS_API_KEY;
    await srv.close();
  }
});
