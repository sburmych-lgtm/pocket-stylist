import { z } from "zod";
import { isConfiguredSecret } from "./app-status.js";
import { generateGeminiText, geminiJsonConfig, geminiTextAndImageContent } from "./gemini-client.js";
import { parseGeminiJson } from "./gemini-utils.js";
import { recordGeminiUsage } from "./gemini-usage.js";
import { WARDROBE_CATEGORIES, normalizeCategory } from "../../src/shared/wardrobe-categories.js";
import { WARDROBE_SEASONS } from "../../src/shared/wardrobe-seasons.js";

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_CLOTHING_TIMEOUT_MS ?? 20_000);
const GEMINI_CLOTHING_MODEL = process.env.GEMINI_CLOTHING_MODEL ?? "gemini-2.5-flash";
const GEMINI_CLOTHING_ATTEMPTS = Number(process.env.GEMINI_CLOTHING_ATTEMPTS ?? 2);
const GEMINI_CLOTHING_MIN_INTERVAL_MS = Math.max(
  0,
  Number(process.env.GEMINI_CLOTHING_MIN_INTERVAL_MS ?? 13_000),
);

const CLOTHING_CATEGORIES = WARDROBE_CATEGORIES;

const COLORS = [
  "black", "white", "grey", "navy", "blue", "light-blue", "red", "burgundy",
  "pink", "green", "olive", "beige", "brown", "tan", "cream", "yellow",
  "orange", "purple", "lavender", "gold", "silver", "multicolor", "camel",
  "taupe", "khaki", "coffee", "mocha", "stone", "charcoal", "off-white",
  "denim-blue", "unknown",
] as const;

const PATTERNS = [
  "solid", "striped", "plaid", "floral", "polka-dot", "geometric",
  "animal-print", "abstract", "paisley", "camouflage", "graphic",
  "checkered", "houndstooth", "unknown",
] as const;

const FABRICS = [
  "cotton", "polyester", "silk", "wool", "denim", "leather", "linen",
  "cashmere", "nylon", "fleece", "velvet", "suede", "knit", "chiffon",
  "viscose", "rayon", "spandex", "elastane", "acrylic", "polyamide",
  "unknown",
] as const;

const SEASONS = WARDROBE_SEASONS;
const LOW_CONFIDENCE_THRESHOLD = 0.5;
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
  reviewSeverity?: "ok" | "suggestion" | "critical";
  analysisStatus?: "ok" | "partial" | "failed";
  rawCategory?: string | null;
  rawColorPrimary?: string | null;
  rawPattern?: string | null;
  rawFabric?: string | null;
  rawSeason?: string | null;
}

type ReviewableClothingAnalysis = Omit<ClothingAnalysis, "needsReview" | "reviewReasons"> &
  Partial<Pick<ClothingAnalysis, "needsReview" | "reviewReasons">>;

export const FALLBACK_CLOTHING_ANALYSIS = {
  category: "tops",
  subcategory: "unknown",
  colorPrimary: "unknown",
  colorHex: "#808080",
  pattern: "unknown",
  fabric: "unknown",
  formalityLevel: 3,
  season: "all",
  brand: null,
  confidence: 0,
  needsReview: true,
  reviewReasons: ["analysis_failed"],
  reviewSeverity: "critical",
  analysisStatus: "failed",
} as const satisfies ClothingAnalysis;

const RawClothingAnalysisSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  colorPrimary: z.string().optional(),
  colorHex: z.string().optional(),
  pattern: z.string().optional(),
  fabric: z.string().optional(),
  formalityLevel: z.coerce.number().optional(),
  season: z.string().optional(),
  brand: z.string().nullable().optional(),
  confidence: z.coerce.number().optional(),
});

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-");
}

const COLOR_ALIASES: Record<string, (typeof COLORS)[number]> = {
  gray: "grey",
  "light-grey": "grey",
  "light-gray": "grey",
  "dark-grey": "charcoal",
  "dark-gray": "charcoal",
  graphite: "charcoal",
  "washed-blue": "denim-blue",
  denim: "denim-blue",
  "denim blue": "denim-blue",
  sky: "light-blue",
  "sky-blue": "light-blue",
  azure: "light-blue",
  "cream-white": "cream",
  ivory: "off-white",
  ecru: "off-white",
  "warm-white": "off-white",
  sand: "stone",
  greige: "taupe",
  mushroom: "taupe",
  beige: "beige",
  camel: "camel",
  caramel: "camel",
  khaki: "khaki",
  olive: "olive",
  coffee: "coffee",
  "coffee-with-milk": "coffee",
  latte: "coffee",
  cappuccino: "coffee",
  mocha: "mocha",
  chocolate: "brown",
  maroon: "burgundy",
  wine: "burgundy",
};

const PATTERN_ALIASES: Record<string, (typeof PATTERNS)[number]> = {
  plain: "solid",
  none: "solid",
  check: "checkered",
  checked: "checkered",
  checks: "checkered",
  tartan: "plaid",
  gingham: "checkered",
  dots: "polka-dot",
  "polka-dots": "polka-dot",
  logo: "graphic",
  print: "graphic",
};

const FABRIC_ALIASES: Record<string, (typeof FABRICS)[number]> = {
  jean: "denim",
  jeans: "denim",
  knitwear: "knit",
  knitted: "knit",
  jersey: "cotton",
  viscose: "viscose",
  rayon: "rayon",
  elastane: "elastane",
  lycra: "spandex",
  acrylic: "acrylic",
  polyamide: "polyamide",
  fauxleather: "leather",
  "faux-leather": "leather",
};

function enumValue<T extends readonly string[]>(
  value: string | null | undefined,
  allowed: T,
  aliases: Record<string, T[number]>,
  fallback: T[number],
): T[number] {
  const token = normalizeToken(value);
  if ((allowed as readonly string[]).includes(token)) return token as T[number];
  return aliases[token] ?? fallback;
}

function normalizeSeason(value: string | null | undefined): (typeof SEASONS)[number] {
  const token = normalizeToken(value);
  if ((SEASONS as readonly string[]).includes(token)) return token as (typeof SEASONS)[number];
  if (token === "autumn") return "fall";
  if (token === "spring/summer" || token === "spring summer") return "spring-summer";
  if (token === "summer/autumn" || token === "summer/fall" || token === "summer fall") return "summer-fall";
  if (token === "autumn/winter" || token === "fall/winter" || token === "fall winter") return "fall-winter";
  if (token === "winter/spring" || token === "winter spring") return "winter-spring";
  if (token === "demi-season" || token === "mid-season" || token === "transitional") return "demi";
  if (token === "year-round" || token === "all-season" || token === "all-seasons") return "all";
  return "all";
}

function normalizeHex(value: string | null | undefined, fallback = FALLBACK_CLOTHING_ANALYSIS.colorHex): string {
  return /^#[0-9A-Fa-f]{6}$/.test(value ?? "") ? value! : fallback;
}

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.45;
  return Math.max(0, Math.min(1, value));
}

function normalizeFormality(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function normalizeClothingAnalysisPayload(payload: unknown): ClothingAnalysis {
  const raw = RawClothingAnalysisSchema.parse(payload);
  const rawCategory = raw.category ?? null;
  const rawColorPrimary = raw.colorPrimary ?? null;
  const rawPattern = raw.pattern ?? null;
  const rawFabric = raw.fabric ?? null;
  const rawSeason = raw.season ?? null;

  const category = normalizeCategory(raw.category);
  const colorPrimary = enumValue(raw.colorPrimary, COLORS, COLOR_ALIASES, "unknown");
  const pattern = enumValue(raw.pattern, PATTERNS, PATTERN_ALIASES, "unknown");
  const fabric = enumValue(raw.fabric, FABRICS, FABRIC_ALIASES, "unknown");
  const season = normalizeSeason(raw.season);
  const reasons: string[] = [];

  if (raw.category && category === "tops" && normalizeToken(raw.category) !== "tops") {
    reasons.push("category_normalized");
  }
  if (raw.colorPrimary && colorPrimary === "unknown") {
    reasons.push("unknown_color");
  }
  if (raw.pattern && pattern === "unknown") {
    reasons.push("unknown_pattern");
  }
  if (raw.fabric && fabric === "unknown") {
    reasons.push("unknown_fabric");
  }

  return {
    category,
    subcategory: raw.subcategory?.trim() || FALLBACK_CLOTHING_ANALYSIS.subcategory,
    colorPrimary,
    colorHex: normalizeHex(raw.colorHex, colorPrimary === "unknown" ? "#808080" : FALLBACK_CLOTHING_ANALYSIS.colorHex),
    pattern,
    fabric,
    formalityLevel: normalizeFormality(raw.formalityLevel),
    season,
    brand: raw.brand?.trim() || null,
    confidence: normalizeConfidence(raw.confidence),
    needsReview: reasons.length > 0,
    reviewReasons: reasons,
    analysisStatus: reasons.length > 0 ? "partial" : "ok",
    rawCategory,
    rawColorPrimary,
    rawPattern,
    rawFabric,
    rawSeason,
  };
}

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
- Treat "season" as when the item is comfortable to wear outdoors, not as a fashion collection label. Use transition values when one item honestly fits two neighboring seasons: "spring-summer", "summer-fall", "fall-winter", "winter-spring"; use "demi" for classic spring/fall mid-season pieces.
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

export function createMinIntervalScheduler(
  intervalMs: number,
  now: () => number = () => Date.now(),
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): () => Promise<void> {
  let nextAvailableAt = 0;
  let tail = Promise.resolve();

  return () => {
    const run = tail.then(async () => {
      const waitMs = Math.max(0, nextAvailableAt - now());
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      nextAvailableAt = Math.max(now(), nextAvailableAt) + intervalMs;
    });
    tail = run.catch(() => undefined);
    return run;
  };
}

const waitForClothingAnalysisSlot = createMinIntervalScheduler(GEMINI_CLOTHING_MIN_INTERVAL_MS);

function loweredConfidence(confidence: number): number {
  return Math.min(confidence, REVIEW_CONFIDENCE_CAP);
}

function outerwearSeason(subcategory: string): "fall" | "winter" {
  if (HEAVY_OUTERWEAR_RE.test(subcategory)) return "winter";
  if (LIGHT_OUTERWEAR_RE.test(subcategory)) return "fall";
  return "fall";
}

function reviewSeverityFor(reasons: string[]): ClothingAnalysis["reviewSeverity"] {
  if (reasons.includes("analysis_failed") || reasons.includes("analysis_unavailable")) {
    return "critical";
  }
  if (
    reasons.some((reason) =>
      [
        "outerwear_summer_conflict",
        "cold_fabric_summer_conflict",
        "light_fabric_winter_conflict",
        "open_footwear_winter_conflict",
        "swimwear_winter_conflict",
        "unknown_color",
        "unknown_fabric",
      ].includes(reason),
    )
  ) {
    return "suggestion";
  }
  return reasons.length > 0 ? "suggestion" : "ok";
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
  const reviewSeverity = reviewSeverityFor(reasons);
  const item = {
    ...input,
    category,
    season,
    confidence,
    needsReview,
    reviewReasons: reasons,
    reviewSeverity,
    analysisStatus: input.analysisStatus ?? (needsReview ? "partial" : "ok"),
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

  let lastError: unknown;
  const attempts = Math.max(1, GEMINI_CLOTHING_ATTEMPTS);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForClothingAnalysisSlot();
      recordGeminiUsage("clothing-analysis");
      const text = await generateGeminiText({
        model: GEMINI_CLOTHING_MODEL,
        contents: geminiTextAndImageContent(ANALYSIS_PROMPT, imageBase64, mimeType),
        config: geminiJsonConfig({
          temperature: 0.1,
        }),
        timeoutMs: GEMINI_TIMEOUT_MS,
        timeoutMessage: "Gemini clothing analysis timed out",
      });

      return reviewClothingAnalysis(normalizeClothingAnalysisPayload(parseGeminiJson(text))).item;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini clothing analysis failed");
}

export { CLOTHING_CATEGORIES, COLORS, PATTERNS, FABRICS, SEASONS };
