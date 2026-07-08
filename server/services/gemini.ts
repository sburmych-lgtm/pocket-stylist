import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { isConfiguredSecret } from "./app-status.js";
import { parseGeminiJson, withTimeout } from "./gemini-utils.js";
import { recordGeminiUsage } from "./gemini-usage.js";
import { WARDROBE_CATEGORIES, normalizeCategory } from "../../src/shared/wardrobe-categories.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const GEMINI_TIMEOUT_MS = 10_000;

const CLOTHING_CATEGORIES = WARDROBE_CATEGORIES;

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
const LOW_CONFIDENCE_THRESHOLD = 0.7;
const REVIEW_CONFIDENCE_CAP = 0.69;
const HEAVY_OUTERWEAR_RE =
  /puffer|parka|down|winter|ski|snow|coat|overcoat|anorak|duffle|пухов|парка|пальт|дублян|шуб|зимов/i;
const LIGHT_OUTERWEAR_RE =
  /trench|rain|windbreaker|shell|bomber|denim jacket|leather jacket|blazer|тренч|дощов|вітрів|бомбер|блейзер/i;
const OPEN_FOOTWEAR_RE =
  /sandal|flip[- ]?flop|slide|slipper|espadrille|mule|сандал|шльоп|в'?єтнам|капц/i;
const COLD_WEATHER_FABRICS = new Set(["wool", "cashmere", "fleece", "velvet", "suede"]);
const HOT_WEATHER_FABRICS = new Set(["linen", "chiffon"]);

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
  needsReview: boolean;
  reviewReasons: string[];
}

type ReviewableClothingAnalysis = Omit<ClothingAnalysis, "needsReview" | "reviewReasons"> &
  Partial<Pick<ClothingAnalysis, "needsReview" | "reviewReasons">>;

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
  needsReview: true,
  reviewReasons: ["analysis_unavailable"],
} as const satisfies ClothingAnalysis;

const ClothingAnalysisSchema = z.object({
  // Accept anything (string), then normalize through alias map so legacy values
  // like "shoes"/"activewear" land on the new canonical sections.
  category: z
    .string()
    .transform((v) => normalizeCategory(v))
    .catch(FALLBACK_CLOTHING_ANALYSIS.category),
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
  "subcategory": specific type (e.g. "t-shirt", "sneaker", "blazer"),
  "colorPrimary": one of [${COLORS.join(", ")}],
  "colorHex": hex color code of the dominant color,
  "pattern": one of [${PATTERNS.join(", ")}],
  "fabric": one of [${FABRICS.join(", ")}],
  "formalityLevel": 1-5 (1=very casual, 3=business casual, 5=formal),
  "season": one of [${SEASONS.join(", ")}],
  "brand": brand name if visible or null,
  "confidence": 0-1 how confident you are in the analysis
}

Category routing rules — pick the MOST SPECIFIC section:
- "jeans" for any denim trousers (do NOT use "bottoms" or "pants" for denim)
- "pants" for non-denim trousers/chinos/joggers
- "skirts" for skirts only (not dresses)
- "footwear" for any shoes/boots/sneakers/sandals
- "underwear" for bras/panties/briefs/boxers
- "pajamas" for sleepwear sets and nightgowns
- "swimwear" for bikinis/one-pieces/swim trunks
- "sportswear" for athletic / gym wear (workout tops, leggings, training shoes)
- "accessories" for bags/belts/scarves/hats/jewelry/watches
- "outerwear" for coats/jackets/parkas
- "suits" only for formal matching sets
- "dresses" for one-piece dresses
- "tops" for non-athletic shirts/blouses/t-shirts
- "bottoms" ONLY as a last resort if none of the above applies

Season/fabric disambiguation rules:
- Treat "season" as when the item is comfortable to wear outdoors, not as a fashion collection label.
- Outerwear (coat, jacket, parka, puffer, trench, raincoat, bomber, blazer) must NOT be "summer". Use "winter" for puffer/down/parka/heavy coat, "fall" for trench/raincoat/bomber/leather/denim jacket, or "all" only if genuinely season-neutral.
- Wool, cashmere, fleece, velvet and suede must NOT be "summer". Prefer "winter" or "fall".
- Linen, chiffon, swimwear and open footwear usually belong to "summer"; they must NOT be "winter" unless the photo clearly shows insulated winter construction.
- Sandals, slides, flip-flops, espadrilles and open mules must NOT be "winter".
- If category/fabric/season conflict or the item is ambiguous, lower "confidence" below 0.70 instead of forcing a confident guess.

Rules:
- Respond with ONLY the JSON object, no markdown fences
- If unsure about a field, use the most likely value but lower confidence
- colorHex must be a valid hex like #FF5733`;

function withReason(reasons: string[], reason: string): string[] {
  return reasons.includes(reason) ? reasons : [...reasons, reason];
}

function loweredConfidence(confidence: number): number {
  return Math.min(confidence, REVIEW_CONFIDENCE_CAP);
}

function outerwearSeason(subcategory: string): "fall" | "winter" {
  if (HEAVY_OUTERWEAR_RE.test(subcategory)) return "winter";
  if (LIGHT_OUTERWEAR_RE.test(subcategory)) return "fall";
  return "fall";
}

export function reviewClothingAnalysis(
  input: ReviewableClothingAnalysis,
  options: { trustManualReview?: boolean } = {},
): {
  item: ClothingAnalysis;
  needsReview: boolean;
  reviewReasons: string[];
} {
  const category = normalizeCategory(input.category);
  const subcategory = input.subcategory.toLowerCase();
  const fabric = input.fabric.toLowerCase();

  let season = input.season;
  let confidence = input.confidence;
  let reasons = [...(input.reviewReasons ?? [])];

  if (category === "outerwear" && season === "summer") {
    season = outerwearSeason(subcategory);
    confidence = loweredConfidence(confidence);
    reasons = withReason(reasons, "outerwear_summer_conflict");
  }

  if (COLD_WEATHER_FABRICS.has(fabric) && season === "summer") {
    season = "winter";
    confidence = loweredConfidence(confidence);
    reasons = withReason(reasons, "cold_fabric_summer_conflict");
  }

  if (HOT_WEATHER_FABRICS.has(fabric) && season === "winter") {
    season = "summer";
    confidence = loweredConfidence(confidence);
    reasons = withReason(reasons, "light_fabric_winter_conflict");
  }

  if (category === "footwear" && OPEN_FOOTWEAR_RE.test(subcategory) && season === "winter") {
    season = "summer";
    confidence = loweredConfidence(confidence);
    reasons = withReason(reasons, "open_footwear_winter_conflict");
  }

  if (category === "swimwear" && season === "winter") {
    season = "summer";
    confidence = loweredConfidence(confidence);
    reasons = withReason(reasons, "swimwear_winter_conflict");
  }

  if (!options.trustManualReview && confidence < LOW_CONFIDENCE_THRESHOLD) {
    reasons = withReason(reasons, "low_confidence");
  }

  const needsReview = reasons.length > 0;
  const item = {
    ...input,
    category,
    season,
    confidence,
    needsReview,
    reviewReasons: reasons,
  };

  return { item, needsReview, reviewReasons: reasons };
}

export async function analyzeClothingImage(
  imageBase64: string,
  mimeType: string,
): Promise<ClothingAnalysis> {
  if (!isConfiguredSecret(process.env.GEMINI_API_KEY)) {
    throw new Error("Gemini API key is not configured");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  recordGeminiUsage("clothing-analysis");
  const result = await withTimeout(
    model.generateContent(
      [
        ANALYSIS_PROMPT,
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ],
      { timeout: GEMINI_TIMEOUT_MS },
    ),
    GEMINI_TIMEOUT_MS,
    "Gemini clothing analysis timed out",
  );

  const text = result.response.text().trim();
  return reviewClothingAnalysis(ClothingAnalysisSchema.parse(parseGeminiJson(text))).item;
}

export { CLOTHING_CATEGORIES, COLORS, PATTERNS, FABRICS, SEASONS };
