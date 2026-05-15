import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { isConfiguredSecret } from "./app-status.js";
import { parseGeminiJson, withTimeout } from "./gemini-utils.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const GEMINI_TIMEOUT_MS = 10_000;

export interface ColorAnalysisResult {
  season: string;
  undertone: string;
  contrast: string;
  palette: Array<{ name: string; hex: string }>;
  avoid: Array<{ name: string; hex: string }>;
  description: string;
}

const COLOR_SEASONS = [
  "Bright Spring",
  "True Spring",
  "Light Spring",
  "Light Summer",
  "True Summer",
  "Soft Summer",
  "Soft Autumn",
  "True Autumn",
  "Deep Autumn",
  "Deep Winter",
  "True Winter",
  "Bright Winter",
] as const;

const DEFAULT_PALETTE = [
  { name: "Soft Navy", hex: "#3C4A5C" },
  { name: "Dusty Rose", hex: "#D4A0A0" },
  { name: "Sage", hex: "#9CAF88" },
];

const DEFAULT_AVOID = [
  { name: "Neon Orange", hex: "#FF6600" },
  { name: "Acid Yellow", hex: "#DFFF00" },
];

const ColorEntrySchema = z.object({
  name: z.string().min(1).catch("Neutral"),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).catch("#808080"),
});

const ColorAnalysisSchema = z.object({
  season: z.enum(COLOR_SEASONS).catch("Soft Summer"),
  undertone: z.enum(["warm", "cool", "neutral"]).catch("neutral"),
  contrast: z.enum(["high", "medium", "low"]).catch("medium"),
  palette: z.array(ColorEntrySchema).min(1).catch(DEFAULT_PALETTE),
  avoid: z.array(ColorEntrySchema).min(1).catch(DEFAULT_AVOID),
  description: z.string().catch("Color analysis completed with a conservative fallback."),
});

const COLOR_ANALYSIS_PROMPT = `You are an expert color analyst. Analyze this selfie photo and determine the person's seasonal color type.

Evaluate:
1. Skin undertone (warm / cool / neutral)
2. Eye color
3. Hair color
4. Contrast level between skin, hair, and eyes (high / medium / low)
5. The 12-season color type. Choose one of:
   - Bright Spring, True Spring, Light Spring
   - Light Summer, True Summer, Soft Summer
   - Soft Autumn, True Autumn, Deep Autumn
   - Deep Winter, True Winter, Bright Winter

Then provide:
- 12 best colors for this person (name + hex code)
- 6 colors this person should avoid (name + hex code)
- A brief 1-2 sentence explanation of why this season type fits

Return ONLY valid JSON with this exact structure (no markdown fences, no explanation outside JSON):
{
  "season": "Soft Summer",
  "undertone": "cool",
  "contrast": "low",
  "palette": [
    { "name": "Dusty Rose", "hex": "#D4A0A0" }
  ],
  "avoid": [
    { "name": "Bright Orange", "hex": "#FF6600" }
  ],
  "description": "Your cool undertone and low contrast between features..."
}

Rules:
- palette must have exactly 12 colors
- avoid must have exactly 6 colors
- All hex codes must be valid 6-digit hex with # prefix
- season must be one of the 12 types listed above
- undertone must be one of: warm, cool, neutral
- contrast must be one of: high, medium, low
- Reply ONLY valid JSON. No markdown, no explanation.`;

export async function analyzeColorType(
  imageBase64: string,
): Promise<ColorAnalysisResult> {
  if (!isConfiguredSecret(process.env.GEMINI_API_KEY)) {
    throw new Error("Gemini API key is not configured");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await withTimeout(
    model.generateContent([
      COLOR_ANALYSIS_PROMPT,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      },
    ]),
    GEMINI_TIMEOUT_MS,
    "Color analysis timed out",
  );
  const text = result.response.text().trim();
  return ColorAnalysisSchema.parse(parseGeminiJson(text));
}
