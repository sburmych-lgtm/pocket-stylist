import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export interface ColorAnalysisResult {
  season: string;
  undertone: string;
  contrast: string;
  palette: Array<{ name: string; hex: string }>;
  avoid: Array<{ name: string; hex: string }>;
  description: string;
}

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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const resultPromise = model.generateContent([
    COLOR_ANALYSIS_PROMPT,
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64,
      },
    },
  ]);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Color analysis timed out")), 10_000),
  );

  const result = await Promise.race([resultPromise, timeoutPromise]);
  const text = result.response.text().trim();
  const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(json) as ColorAnalysisResult;

  // Validate structure
  if (!parsed.season || !parsed.undertone || !parsed.contrast) {
    throw new Error("Invalid color analysis response: missing required fields");
  }

  if (!Array.isArray(parsed.palette) || parsed.palette.length === 0) {
    throw new Error("Invalid color analysis response: missing palette");
  }

  if (!Array.isArray(parsed.avoid) || parsed.avoid.length === 0) {
    throw new Error("Invalid color analysis response: missing avoid colors");
  }

  // Validate hex codes
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  for (const color of [...parsed.palette, ...parsed.avoid]) {
    if (!hexRegex.test(color.hex)) {
      color.hex = "#808080"; // fallback for invalid hex
    }
  }

  return parsed;
}
