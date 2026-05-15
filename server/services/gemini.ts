import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { isConfiguredSecret } from "./app-status.js";
import { parseGeminiJson, withTimeout } from "./gemini-utils.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const GEMINI_TIMEOUT_MS = 10_000;

const CLOTHING_CATEGORIES = [
  "tops", "bottoms", "dresses", "outerwear", "shoes",
  "accessories", "activewear", "swimwear", "sleepwear", "suits",
] as const;

const COLORS = [
  "black", "white", "grey", "navy", "blue", "light-blue", "red", "burgundy",
  "pink", "green", "olive", "beige", "brown", "tan", "cream", "yellow",
  "orange", "purple", "lavender", "gold", "silver", "multicolor",
] as const;

const PATTERNS = [
  "solid", "striped", "plaid", "floral", "polka-dot", "geometric",
  "animal-print", "abstract", "paisley", "camouflage", "graphic",
] as const;

const FABRICS = [
  "cotton", "polyester", "silk", "wool", "denim", "leather", "linen",
  "cashmere", "nylon", "fleece", "velvet", "suede", "knit", "chiffon",
] as const;

const SEASONS = ["spring", "summer", "fall", "winter", "all"] as const;

export interface ClothingAnalysis {
  category: string;
  subcategory: string;
  colorPrimary: string;
  colorHex: string;
  pattern: string;
  fabric: string;
  formalityLevel: number;
  season: string;
  brand: string | null;
  confidence: number;
}

export const FALLBACK_CLOTHING_ANALYSIS = {
  category: "tops",
  subcategory: "unknown",
  colorPrimary: "black",
  colorHex: "#000000",
  pattern: "solid",
  fabric: "cotton",
  formalityLevel: 3,
  season: "all",
  brand: null,
  confidence: 0,
} as const satisfies ClothingAnalysis;

const ClothingAnalysisSchema = z.object({
  category: z.enum(CLOTHING_CATEGORIES).catch(FALLBACK_CLOTHING_ANALYSIS.category),
  subcategory: z.string().min(1).catch(FALLBACK_CLOTHING_ANALYSIS.subcategory),
  colorPrimary: z.enum(COLORS).catch(FALLBACK_CLOTHING_ANALYSIS.colorPrimary),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).catch(FALLBACK_CLOTHING_ANALYSIS.colorHex),
  pattern: z.enum(PATTERNS).catch(FALLBACK_CLOTHING_ANALYSIS.pattern),
  fabric: z.enum(FABRICS).catch(FALLBACK_CLOTHING_ANALYSIS.fabric),
  formalityLevel: z.coerce.number().min(1).max(5).catch(FALLBACK_CLOTHING_ANALYSIS.formalityLevel),
  season: z.enum(SEASONS).catch(FALLBACK_CLOTHING_ANALYSIS.season),
  brand: z.string().nullable().catch(FALLBACK_CLOTHING_ANALYSIS.brand),
  confidence: z.coerce.number().min(0).max(1).catch(FALLBACK_CLOTHING_ANALYSIS.confidence),
});

const ANALYSIS_PROMPT = `Analyze this clothing item photo. Return ONLY valid JSON with these exact fields:
{
  "category": one of [${CLOTHING_CATEGORIES.join(", ")}],
  "subcategory": specific type (e.g. "t-shirt", "jeans", "sneakers"),
  "colorPrimary": one of [${COLORS.join(", ")}],
  "colorHex": hex color code of the dominant color,
  "pattern": one of [${PATTERNS.join(", ")}],
  "fabric": one of [${FABRICS.join(", ")}],
  "formalityLevel": 1-5 (1=very casual, 3=business casual, 5=formal),
  "season": one of [${SEASONS.join(", ")}],
  "brand": brand name if visible or null,
  "confidence": 0-1 how confident you are in the analysis
}

Rules:
- Respond with ONLY the JSON object, no markdown fences
- If unsure about a field, use the most likely value but lower confidence
- colorHex must be a valid hex like #FF5733`;

export async function analyzeClothingImage(
  imageBase64: string,
  mimeType: string,
): Promise<ClothingAnalysis> {
  if (!isConfiguredSecret(process.env.GEMINI_API_KEY)) {
    throw new Error("Gemini API key is not configured");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await withTimeout(
    model.generateContent([
      ANALYSIS_PROMPT,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ]),
    GEMINI_TIMEOUT_MS,
    "Gemini clothing analysis timed out",
  );

  const text = result.response.text().trim();
  return ClothingAnalysisSchema.parse(parseGeminiJson(text));
}

export { CLOTHING_CATEGORIES, COLORS, PATTERNS, FABRICS, SEASONS };
