import { z } from "zod";
import { isConfiguredSecret } from "./app-status.js";
import { generateGeminiText, geminiJsonConfig, geminiTextAndImageContent } from "./gemini-client.js";
import { parseGeminiJson } from "./gemini-utils.js";
import { recordGeminiUsage } from "./gemini-usage.js";

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
  { name: "Slate Blue", hex: "#6A7B8C" },
  { name: "Mauve", hex: "#B784A7" },
  { name: "Soft Plum", hex: "#76506A" },
  { name: "Cool Taupe", hex: "#9A8F8A" },
  { name: "Powder Blue", hex: "#A9C6D9" },
  { name: "Berry", hex: "#8A3F5D" },
  { name: "Sea Green", hex: "#6F9C91" },
  { name: "Charcoal", hex: "#4A4D52" },
  { name: "Soft White", hex: "#F2EFEA" },
];

const DEFAULT_AVOID = [
  { name: "Neon Orange", hex: "#FF6600" },
  { name: "Acid Yellow", hex: "#DFFF00" },
  { name: "Electric Lime", hex: "#CCFF00" },
  { name: "Warm Camel", hex: "#C19A6B" },
  { name: "Tomato Red", hex: "#FF3B30" },
  { name: "Bright Gold", hex: "#FFD700" },
];

const ColorEntrySchema = z.object({
  name: z.string().min(1).catch("Neutral"),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).catch("#808080"),
});

const ColorAnalysisSchema = z.object({
  season: z.enum(COLOR_SEASONS).catch("Soft Summer"),
  undertone: z.enum(["warm", "cool", "neutral"]).catch("neutral"),
  contrast: z.enum(["high", "medium", "low"]).catch("medium"),
  palette: z.array(ColorEntrySchema).length(12).catch(DEFAULT_PALETTE),
  avoid: z.array(ColorEntrySchema).length(6).catch(DEFAULT_AVOID),
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

  recordGeminiUsage("color-season");
  const text = await generateGeminiText({
    contents: geminiTextAndImageContent(COLOR_ANALYSIS_PROMPT, imageBase64, "image/jpeg"),
    config: geminiJsonConfig({
      temperature: 0.2,
    }),
    timeoutMs: GEMINI_TIMEOUT_MS,
    timeoutMessage: "Color analysis timed out",
  });
  return ColorAnalysisSchema.parse(parseGeminiJson(text));
}
