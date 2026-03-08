import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent([
    ANALYSIS_PROMPT,
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
  ]);

  const text = result.response.text().trim();
  // Strip markdown fences if present
  const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(json) as ClothingAnalysis;

  // Clamp/validate
  parsed.formalityLevel = Math.max(1, Math.min(5, parsed.formalityLevel));
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

  return parsed;
}

export { CLOTHING_CATEGORIES, COLORS, PATTERNS, FABRICS, SEASONS };
