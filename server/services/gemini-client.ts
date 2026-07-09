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
}
