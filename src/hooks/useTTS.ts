import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ttsApi, type StylistPersona, type TtsStatus } from "../services/api";

/**
 * Two-tier TTS for the stylist personas.
 *
 * Tier 1: server /api/tts (ElevenLabs). Used when status.elevenlabsEnabled.
 * Tier 2: window.speechSynthesis. Free, on-device, instant — used when the
 *         server tier is disabled or 503s with `useBrowserFallback`.
 *
 * The hook is intentionally self-contained: pages don't need to know which
 * tier is active. The `mode` field is exposed only so UI can hide itself
 * when neither tier is available.
 *
 * Per-persona prosody for the browser tier (no-op for the server tier,
 * which controls voice via voice id):
 *   classic — defaults
 *   sassy   — pitch 1.3 / rate 1.1
 *   manly   — pitch 0.7 / rate 0.9
 *   kind    — pitch 1.1 / rate 0.85
 */

export type TtsStatusState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "playing" }
  | { status: "error"; error: string };

export type TtsMode = "elevenlabs" | "browser" | "unavailable";

interface PersonaProsody {
  pitch: number;
  rate: number;
}

const PERSONA_PROSODY: Record<StylistPersona, PersonaProsody> = {
  classic: { pitch: 1.0, rate: 1.0 },
  sassy: { pitch: 1.3, rate: 1.1 },
  manly: { pitch: 0.7, rate: 0.9 },
  kind: { pitch: 1.1, rate: 0.85 },
};

const BROWSER_LANG = "uk-UA";
const BLOB_CACHE_LIMIT = 5;

interface BlobCacheEntry {
  key: string;
  blobUrl: string;
}

function makeKey(text: string, persona: StylistPersona): string {
  return `${persona}::${text}`;
}

function hasBrowserSpeech(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedStatusPromise: Promise<TtsStatus> | null = null;

function getCachedStatus(): Promise<TtsStatus> {
  if (!cachedStatusPromise) {
    cachedStatusPromise = ttsApi.getStatus().catch((err: unknown) => {
      // Surface the failure once but let the next call retry — the user
      // might just be offline.
      cachedStatusPromise = null;
      throw err;
    });
  }
  return cachedStatusPromise;
}

export interface UseTtsResult {
  speak: (text: string, persona?: StylistPersona) => Promise<void>;
  stop: () => void;
  status: TtsStatusState;
  mode: TtsMode;
}

export function useTTS(): UseTtsResult {
  const [status, setStatus] = useState<TtsStatusState>({ status: "idle" });
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const blobCacheRef = useRef<BlobCacheEntry[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Tear down any in-flight playback so navigation cancels audio.
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      if (utteranceRef.current && hasBrowserSpeech()) {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      }
      // Revoke cached blob URLs — preventing a memory leak across SPA navigations.
      for (const entry of blobCacheRef.current) URL.revokeObjectURL(entry.blobUrl);
      blobCacheRef.current = [];
    };
  }, []);

  const browserAvailable = useMemo(() => hasBrowserSpeech(), []);

  const mode: TtsMode = useMemo(() => {
    if (serverEnabled) return "elevenlabs";
    if (browserAvailable) return "browser";
    if (serverEnabled === null) return browserAvailable ? "browser" : "unavailable";
    return "unavailable";
  }, [serverEnabled, browserAvailable]);

  const stop = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
      audioElRef.current = null;
    }
    if (hasBrowserSpeech()) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    if (mountedRef.current) {
      setStatus({ status: "idle" });
    }
  }, []);

  const cacheBlob = useCallback((key: string, blobUrl: string): void => {
    const cache = blobCacheRef.current;
    // Evict any older entry with the same key first so we don't double-store.
    const existingIdx = cache.findIndex((e) => e.key === key);
    if (existingIdx >= 0) {
      URL.revokeObjectURL(cache[existingIdx].blobUrl);
      cache.splice(existingIdx, 1);
    }
    cache.push({ key, blobUrl });
    while (cache.length > BLOB_CACHE_LIMIT) {
      const oldest = cache.shift();
      if (oldest) URL.revokeObjectURL(oldest.blobUrl);
    }
  }, []);

  const findCachedBlob = useCallback((key: string): string | undefined => {
    const cache = blobCacheRef.current;
    const idx = cache.findIndex((e) => e.key === key);
    if (idx < 0) return undefined;
    const entry = cache[idx];
    // Promote to most-recent.
    cache.splice(idx, 1);
    cache.push(entry);
    return entry.blobUrl;
  }, []);

  const playBlobUrl = useCallback(
    (blobUrl: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const audio = new Audio(blobUrl);
        audioElRef.current = audio;
        audio.onended = () => {
          if (audioElRef.current === audio) audioElRef.current = null;
          if (mountedRef.current) setStatus({ status: "idle" });
          resolve();
        };
        audio.onerror = () => {
          if (audioElRef.current === audio) audioElRef.current = null;
          reject(new Error("audio_playback_failed"));
        };
        audio
          .play()
          .then(() => {
            if (mountedRef.current) setStatus({ status: "playing" });
          })
          .catch(reject);
      }),
    [],
  );

  const speakBrowser = useCallback(
    (text: string, persona: StylistPersona): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!hasBrowserSpeech()) {
          reject(new Error("speech_synthesis_unavailable"));
          return;
        }
        const synth = window.speechSynthesis;
        synth.cancel(); // never overlap
        const utterance = new SpeechSynthesisUtterance(text);
        const { pitch, rate } = PERSONA_PROSODY[persona];
        utterance.pitch = pitch;
        utterance.rate = rate;
        utterance.lang = BROWSER_LANG;

        // Prefer a Ukrainian voice if available; otherwise let the platform decide.
        const voices = synth.getVoices();
        const ukVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("uk"));
        if (ukVoice) utterance.voice = ukVoice;

        utteranceRef.current = utterance;
        utterance.onend = () => {
          if (utteranceRef.current === utterance) utteranceRef.current = null;
          if (mountedRef.current) setStatus({ status: "idle" });
          resolve();
        };
        utterance.onerror = (event) => {
          if (utteranceRef.current === utterance) utteranceRef.current = null;
          reject(new Error(event.error ?? "speech_synthesis_failed"));
        };
        synth.speak(utterance);
        if (mountedRef.current) setStatus({ status: "playing" });
      }),
    [],
  );

  const speak = useCallback(
    async (text: string, persona: StylistPersona = "classic"): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Cancel any current playback FIRST — we never overlap.
      stop();

      setStatus({ status: "loading" });

      // Resolve server availability lazily, the first time we're asked.
      let elevenEnabled = serverEnabled;
      if (elevenEnabled === null) {
        try {
          const s = await getCachedStatus();
          elevenEnabled = s.elevenlabsEnabled;
          if (mountedRef.current) setServerEnabled(elevenEnabled);
        } catch {
          elevenEnabled = false;
          if (mountedRef.current) setServerEnabled(false);
        }
      }

      const key = makeKey(trimmed, persona);

      if (elevenEnabled) {
        try {
          const cachedUrl = findCachedBlob(key);
          if (cachedUrl) {
            await playBlobUrl(cachedUrl);
            return;
          }
          const blob = await ttsApi.synthesize(trimmed, persona);
          const url = URL.createObjectURL(blob);
          cacheBlob(key, url);
          await playBlobUrl(url);
          return;
        } catch (err) {
          // Server tier failed — degrade to browser tier silently.
          const message = err instanceof Error ? err.message : String(err);
          if (message === "tts_unavailable") {
            if (mountedRef.current) setServerEnabled(false);
          }
          if (!hasBrowserSpeech()) {
            if (mountedRef.current) {
              setStatus({ status: "error", error: message });
            }
            return;
          }
          // Fall through to the browser path.
        }
      }

      if (hasBrowserSpeech()) {
        try {
          await speakBrowser(trimmed, persona);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (mountedRef.current) {
            setStatus({ status: "error", error: message });
          }
        }
        return;
      }

      if (mountedRef.current) {
        setStatus({ status: "error", error: "tts_unavailable" });
      }
    },
    [serverEnabled, stop, findCachedBlob, playBlobUrl, cacheBlob, speakBrowser],
  );

  return { speak, stop, status, mode };
}
