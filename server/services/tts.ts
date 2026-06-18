import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { isConfiguredSecret, type AppStatus } from "./app-status.js";

/**
 * Persona-aware ElevenLabs Text-to-Speech with two-tier fallback.
 *
 * Tier 1 (premium): ElevenLabs API. Activated only when ELEVENLABS_API_KEY
 * is configured. Each persona gets its own voice id (overridable via env).
 *
 * Tier 2 (free, on the client): browser SpeechSynthesis. Handled in the
 * React hook — this server module is a no-op when ElevenLabs is disabled.
 *
 * Caching: each (text, persona) tuple is hashed (SHA-256, prefix=16 chars)
 * and cached. If Cloudinary is configured we cache the mp3 there (cheap
 * CDN, survives redeploys). Otherwise we keep an in-memory LRU bounded
 * to MAX_INMEMORY_ENTRIES so a single dyno doesn't blow up.
 */

export type StylistPersona = "classic" | "sassy" | "manly" | "kind";

export const STYLIST_PERSONAS: readonly StylistPersona[] = [
  "classic",
  "sassy",
  "manly",
  "kind",
] as const;

const DEFAULT_VOICE_IDS: Record<StylistPersona, string> = {
  classic: "21m00Tcm4TlvDq8ikWAM", // Rachel
  sassy: "AZnzlk1XvdvUeBnXmlld", // Domi
  manly: "ErXwobaYiN019PkySvjV", // Antoni
  kind: "EXAVITQu4vr4xnSDxMaL", // Bella
};

const PERSONA_ENV_KEYS: Record<StylistPersona, string> = {
  classic: "ELEVENLABS_VOICE_CLASSIC",
  sassy: "ELEVENLABS_VOICE_SASSY",
  manly: "ELEVENLABS_VOICE_MANLY",
  kind: "ELEVENLABS_VOICE_KIND",
};

const ELEVENLABS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";
const ELEVENLABS_TIMEOUT_MS = 15_000;

export const TEXT_MAX_LENGTH = 800;
const MAX_INMEMORY_ENTRIES = 100;

export function isTtsElevenLabsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isConfiguredSecret(env.ELEVENLABS_API_KEY);
}

export function resolvePersonaVoiceIds(
  env: NodeJS.ProcessEnv = process.env,
): Record<StylistPersona, string> {
  const out = { ...DEFAULT_VOICE_IDS };
  for (const persona of STYLIST_PERSONAS) {
    const override = env[PERSONA_ENV_KEYS[persona]];
    if (isConfiguredSecret(override)) {
      out[persona] = override.trim();
    }
  }
  return out;
}

export function isValidPersona(value: unknown): value is StylistPersona {
  return (
    typeof value === "string" &&
    (STYLIST_PERSONAS as readonly string[]).includes(value)
  );
}

interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

function getCloudinaryConfig(
  env: NodeJS.ProcessEnv = process.env,
): CloudinaryConfig | null {
  if (
    isConfiguredSecret(env.CLOUDINARY_CLOUD_NAME) &&
    isConfiguredSecret(env.CLOUDINARY_API_KEY) &&
    isConfiguredSecret(env.CLOUDINARY_API_SECRET)
  ) {
    return {
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    };
  }
  return null;
}

/* ---------- In-memory LRU (insertion-ordered Map) ---------- */

const memoryCache = new Map<string, Buffer>();

function lruGet(key: string): Buffer | undefined {
  const hit = memoryCache.get(key);
  if (hit === undefined) return undefined;
  // Touch: re-insert moves to most-recent slot.
  memoryCache.delete(key);
  memoryCache.set(key, hit);
  return hit;
}

function lruSet(key: string, buf: Buffer): void {
  if (memoryCache.has(key)) memoryCache.delete(key);
  memoryCache.set(key, buf);
  while (memoryCache.size > MAX_INMEMORY_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
}

/** Test-only helper. */
export function _resetTtsCache(): void {
  memoryCache.clear();
}

/* ---------- Cloudinary raw cache ---------- */

function cacheKey(text: string, persona: StylistPersona): string {
  return createHash("sha256")
    .update(`${persona}|${text}`)
    .digest("hex")
    .slice(0, 32);
}

function publicId(key: string): string {
  return `pocket-stylist/tts/${key}`;
}

async function fetchCloudinaryCached(
  cfg: CloudinaryConfig,
  key: string,
): Promise<Buffer | null> {
  try {
    cloudinary.config(cfg);
    const url = cloudinary.url(publicId(key), {
      resource_type: "raw",
      sign_url: true,
      type: "upload",
    });
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 ? buf : null;
  } catch {
    return null;
  }
}

async function storeCloudinary(
  cfg: CloudinaryConfig,
  key: string,
  audio: Buffer,
): Promise<void> {
  try {
    cloudinary.config(cfg);
    const dataUri = `data:audio/mpeg;base64,${audio.toString("base64")}`;
    await cloudinary.uploader.upload(dataUri, {
      resource_type: "raw",
      public_id: publicId(key),
      overwrite: true,
    });
  } catch {
    // Caching failure must NOT break the playback path.
  }
}

/* ---------- ElevenLabs call ---------- */

interface SynthesizeOptions {
  text: string;
  persona: StylistPersona;
  /** Mostly for tests — swap fetch implementation. */
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

export interface SynthesizeResult {
  audio: Buffer;
  cached: boolean;
}

export class TtsError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "tts_unavailable"
      | "tts_failed"
      | "tts_timeout"
      | "invalid_input",
  ) {
    super(message);
    this.name = "TtsError";
  }
}

export async function synthesizeSpeech({
  text,
  persona,
  fetchImpl,
  env = process.env,
}: SynthesizeOptions): Promise<SynthesizeResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new TtsError("text required", "invalid_input");
  }
  if (trimmed.length > TEXT_MAX_LENGTH) {
    throw new TtsError("text too long", "invalid_input");
  }
  if (!isTtsElevenLabsEnabled(env)) {
    throw new TtsError("ElevenLabs not configured", "tts_unavailable");
  }

  const apiKey = env.ELEVENLABS_API_KEY!;
  const voices = resolvePersonaVoiceIds(env);
  const voiceId = voices[persona];

  const key = cacheKey(trimmed, persona);

  // 1) In-memory cache.
  const memHit = lruGet(key);
  if (memHit) return { audio: memHit, cached: true };

  // 2) Cloudinary cache (when configured).
  const cloud = getCloudinaryConfig(env);
  if (cloud) {
    const cloudHit = await fetchCloudinaryCached(cloud, key);
    if (cloudHit) {
      lruSet(key, cloudHit);
      return { audio: cloudHit, cached: true };
    }
  }

  // 3) Live ElevenLabs call.
  const f = fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);
  let res: Response;
  try {
    res = await f(`${ELEVENLABS_ENDPOINT}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TtsError("ElevenLabs timed out", "tts_timeout");
    }
    throw new TtsError("ElevenLabs request failed", "tts_failed");
  }
  clearTimeout(timer);

  if (!res.ok) {
    // Don't leak the API body — it can include the key in some errors.
    throw new TtsError(`ElevenLabs status ${res.status}`, "tts_failed");
  }

  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.byteLength === 0) {
    throw new TtsError("Empty audio response", "tts_failed");
  }

  lruSet(key, audio);
  if (cloud) {
    // Fire and forget — don't block the response.
    void storeCloudinary(cloud, key, audio);
  }

  return { audio, cached: false };
}

export interface TtsStatus {
  elevenlabsEnabled: boolean;
  voices: Record<StylistPersona, string>;
}

export function getTtsStatus(env: NodeJS.ProcessEnv = process.env): TtsStatus {
  return {
    elevenlabsEnabled: isTtsElevenLabsEnabled(env),
    voices: resolvePersonaVoiceIds(env),
  };
}

/** For /api/status — keep the shape minimal so it stays stable. */
export function ttsConfiguredFlag(
  env: NodeJS.ProcessEnv = process.env,
): Pick<AppStatus, never> & { ttsConfigured: boolean } {
  return { ttsConfigured: isTtsElevenLabsEnabled(env) };
}
