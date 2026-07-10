import { GoogleGenAI } from "@google/genai";
import type { Content, ContentListUnion, GenerateContentConfig, Part } from "@google/genai";
import { withTimeout } from "./gemini-utils.js";

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
let clientApiKey: string | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!client || clientApiKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientApiKey = apiKey;
  }
  return client;
}

export function geminiTextPart(text: string): Part {
  return { text };
}

export function geminiImagePart(imageBase64: string, mimeType: string): Part {
  return {
    inlineData: {
      mimeType,
      data: imageBase64,
    },
  };
}

export function geminiUserContent(parts: Part[]): Content {
  return {
    role: "user",
    parts,
  };
}

export function geminiTextAndImageContent(
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Content {
  return geminiUserContent([
    geminiTextPart(prompt),
    geminiImagePart(imageBase64, mimeType),
  ]);
}

export function geminiJsonConfig(config: GenerateContentConfig = {}): GenerateContentConfig {
  return {
    ...config,
    responseMimeType: config.responseMimeType ?? "application/json",
  };
}

const RATE_LIMIT_RETRIES = Math.max(0, Number(process.env.GEMINI_RATE_LIMIT_RETRIES ?? 4));
const RATE_LIMIT_MAX_WAIT_MS = Math.max(1000, Number(process.env.GEMINI_RATE_LIMIT_MAX_WAIT_MS ?? 30_000));

/**
 * Detect a 429 / RESOURCE_EXHAUSTED (free-tier quota) error and return how long
 * to wait before retrying. Gemini embeds the hint two ways — a structured
 * `"retryDelay":"13s"` field and a human `Please retry in 13.8s` phrase. When it
 * is a rate-limit error but no hint is present, fall back to a sane default so a
 * bulk upload self-throttles instead of collapsing into fallback tags.
 */
export function rateLimitDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!/RESOURCE_EXHAUSTED|429|quota|rate.?limit/i.test(message)) return null;
  const structured = message.match(/retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s/i);
  const phrase = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  const seconds = structured ?? phrase;
  const ms = seconds ? Math.ceil(parseFloat(seconds[1]) * 1000) : 12_000;
  // Add a small buffer so we clear the window, and never wait absurdly long.
  return Math.min(ms + 750, RATE_LIMIT_MAX_WAIT_MS);
}

export async function generateGeminiText({
  contents,
  config,
  model = DEFAULT_GEMINI_MODEL,
  timeoutMs,
  timeoutMessage,
}: {
  contents: ContentListUnion;
  config?: GenerateContentConfig;
  model?: string;
  timeoutMs: number;
  timeoutMessage: string;
}): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      const response = await withTimeout(
        getGeminiClient().models.generateContent({
          model,
          contents,
          config: {
            ...config,
            httpOptions: {
              ...config?.httpOptions,
              timeout: timeoutMs,
            },
          },
        }),
        timeoutMs,
        timeoutMessage,
      );
      const text = response.text?.trim() ?? "";
      if (!text) {
        throw new Error("Gemini returned an empty response");
      }
      return text;
    } catch (error) {
      lastError = error;
      const waitMs = rateLimitDelayMs(error);
      // Only the free-tier rate limit is worth waiting out; everything else
      // (bad request, timeout, server error) should surface immediately.
      if (waitMs !== null && attempt < RATE_LIMIT_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}
