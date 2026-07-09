import { z } from "zod";
import type { WardrobeItem } from "../../../src/generated/prisma/client.js";
import { isConfiguredSecret } from "../app-status.js";
import { generateGeminiText, geminiJsonConfig } from "../gemini-client.js";
import { parseGeminiJson } from "../gemini-utils.js";
import { recordGeminiUsage } from "../gemini-usage.js";
import {
  scoreItem,
  groupByCategory,
  colorsHarmonize,
  isFootwearWeatherOk,
  isWetWeather,
  HOT_WEATHER_BLOCKED_FABRICS,
  COLD_WEATHER_BLOCKED_CATEGORIES,
} from "./rules-engine.js";
import { applyPersona, type StylistPersona } from "./personas.js";

const GEMINI_TIMEOUT_MS = 10_000;
const STYLIST_V2_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

type OutfitVariant = "safe" | "balanced" | "bold";
type StylistVersion = "rules" | "v1" | "v2";

interface ColorEntry {
  name: string;
  hex: string;
}

interface OutfitSuggestion {
  name: string;
  items: WardrobeItem[];
  stylingTip: string;
  confidence: number;
  variant?: OutfitVariant;
  stylistVersion?: StylistVersion;
  whyItWorks?: string;
  weatherFit?: string;
  risks?: string[];
}

interface StylingContext {
  mood: { energy: number; boldness: number };
  weatherSeason: string;
  /** Real ambient temperature in °C — drives strict fabric/category gates. */
  temp?: number;
  /** Optional weather descriptor ("Clear", "Rain", "Snow", "Clouds"). */
  condition?: string;
  /** Expected precipitation in mm — wet-weather footwear gate. */
  precipMm?: number;
  formalityRange: { min: number; max: number };
  /** Voice/tone persona for stylingTip copy. Selection logic unaffected. */
  persona?: StylistPersona;
  /** User appearance context — forwarded to Gemini for color harmony. */
  colorSeason?: string | null;
  colorPalette?: ColorEntry[];
  avoidColors?: ColorEntry[];
  genderMode?: string;
}

/**
 * Returns true when this item is appropriate for the current weather.
 * Belt-and-braces — filterWardrobe already gates this on the way in, but
 * Gemini sometimes invents indexes pointing at out-of-season items, so we
 * validate the model's output too.
 */
function isWeatherAppropriate(item: WardrobeItem, ctx: StylingContext): boolean {
  if (item.season !== "all" && item.season !== ctx.weatherSeason) return false;
  if (ctx.temp !== undefined) {
    if (ctx.temp >= 20 && item.fabric && HOT_WEATHER_BLOCKED_FABRICS.has(item.fabric)) {
      return false;
    }
    if (ctx.temp <= 10 && COLD_WEATHER_BLOCKED_CATEGORIES.has(item.category)) {
      return false;
    }
  }
  if (!isFootwearWeatherOk(item, ctx)) return false;
  return true;
}

/**
 * Map Gemini's itemIndexes back onto the EXACT candidate pool that was shown
 * to the model. Indexes outside [0, pool.length) are dropped — this is what
 * guarantees the stylist can never "invent" an item. Exported for tests.
 */
export function mapIndexesToItems<T>(indexes: number[], pool: T[]): T[] {
  const seen = new Set<number>();
  return indexes
    .filter((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= pool.length || seen.has(index)) {
        return false;
      }
      seen.add(index);
      return true;
    })
    .map((index) => pool[index]);
}

export function isStylistV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return STYLIST_V2_ENABLED_VALUES.has((env.STYLIST_V2_ENABLED ?? "").toLowerCase());
}

export function stylistV2RolloutPercent(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.STYLIST_V2_ROLLOUT_PERCENT ?? env.STYLIST_V2_ROLLOUT ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, raw));
}

function stableBucket(input: string): number {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
}

export function shouldUseStylistV2ForUser(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isStylistV2Enabled(env)) return true;
  const rollout = stylistV2RolloutPercent(env);
  return rollout > 0 && stableBucket(userId) < rollout;
}

function resolveStylistVersion(options: { stylistVersion?: "v1" | "v2" }): "v1" | "v2" {
  return options.stylistVersion ?? (isStylistV2Enabled() ? "v2" : "v1");
}

// Attempt pure-code outfit assembly first, fall back to Gemini
export async function generateOutfits(
  candidates: WardrobeItem[],
  ctx: StylingContext,
  count: number = 3,
  options: { useAi?: boolean; stylistVersion?: "v1" | "v2" } = {},
): Promise<OutfitSuggestion[]> {
  // Score and sort candidates
  const scored = candidates.map((item) => ({
    item,
    score: scoreItem(item, ctx),
  }));
  scored.sort((a, b) => b.score - a.score);

  const sortedCandidates = scored.map(({ item }) => item);
  const groups = groupByCategory(sortedCandidates);
  // New canonical categories — keep legacy aliases (shoes/activewear) just
  // in case a row slips through without normalization.
  const tops = groups.get("tops") ?? [];
  const bottoms = [
    ...(groups.get("bottoms") ?? []),
    ...(groups.get("jeans") ?? []),
    ...(groups.get("pants") ?? []),
    ...(groups.get("skirts") ?? []),
  ];
  const dresses = groups.get("dresses") ?? [];
  const outerwear = groups.get("outerwear") ?? [];
  const shoes = [...(groups.get("footwear") ?? []), ...(groups.get("shoes") ?? [])];

  // Build a deterministic safety net first, but prefer the AI result when it
  // is available: the hybrid contract is rules -> Gemini -> rules fallback.
  const pureOutfits = assemblePureOutfits(tops, bottoms, dresses, outerwear, shoes, ctx);
  if (options.useAi === false) {
    const rulesOnly = pureOutfits.length > 0
      ? pureOutfits
      : fallbackOutfit(sortedCandidates, ctx);
    return rulesOnly.slice(0, count).map((outfit) => ({
      ...outfit,
      stylistVersion: "rules",
    }));
  }

  const stylistVersion = resolveStylistVersion(options);
  try {
    const geminiOutfits = stylistVersion === "v2"
      ? await geminiGenerateOutfitsV2(sortedCandidates, ctx, count)
      : await geminiGenerateOutfits(sortedCandidates, ctx, count);
    const safeOutfits = geminiOutfits.filter((outfit) =>
      isCompleteOutfit(outfit.items, ctx) &&
      outfit.items.every((item) => isWeatherAppropriate(item, ctx)) &&
      isPatternUseSafe(outfit.items, stylistVersion) &&
      (stylistVersion === "v2" || hasCompatibleColors(outfit.items)),
    );
    const merged = mergeDistinctOutfits(safeOutfits, pureOutfits, count);
    return merged.length > 0
      ? merged.map((outfit) => ({
          ...outfit,
          stylistVersion: outfit.stylistVersion ?? "rules",
        }))
      : fallbackOutfit(sortedCandidates, ctx).slice(0, count).map((outfit) => ({
          ...outfit,
          stylistVersion: "rules",
        }));
  } catch (err) {
    if (isConfiguredSecret(process.env.GEMINI_API_KEY)) {
      console.error("Gemini outfit generation failed:", err);
    }
    const fallback = pureOutfits.length > 0
      ? pureOutfits
      : fallbackOutfit(sortedCandidates, ctx);
    return fallback.slice(0, count).map((outfit) => ({
      ...outfit,
      stylistVersion: "rules",
      stylingTip: `${outfit.stylingTip} AI тимчасово недоступний, тому це надійний підбір за правилами.`,
    }));
  }
}

function isCompleteOutfit(items: WardrobeItem[], ctx: StylingContext): boolean {
  const categories = new Set(items.map((item) => item.category));
  const hasShoes = categories.has("footwear") || categories.has("shoes");
  const hasBase =
    categories.has("dresses") ||
    (categories.has("tops") &&
      ["bottoms", "jeans", "pants", "skirts"].some((category) => categories.has(category)));
  const needsOuterwear =
    ctx.temp !== undefined
      ? ctx.temp <= 14
      : ctx.weatherSeason === "winter" || ctx.weatherSeason === "fall";
  return hasBase && hasShoes && (!needsOuterwear || categories.has("outerwear"));
}

function hasCompatibleColors(items: WardrobeItem[]): boolean {
  for (let index = 0; index < items.length; index += 1) {
    for (let other = index + 1; other < items.length; other += 1) {
      if (!colorsHarmonize(items[index].colorPrimary, items[other].colorPrimary)) {
        return false;
      }
    }
  }
  return true;
}

function isPatternUseSafe(items: WardrobeItem[], stylistVersion: "v1" | "v2"): boolean {
  const patternedCount = items.filter((item) => item.pattern !== "solid").length;
  return patternedCount <= (stylistVersion === "v2" ? 2 : 1);
}

function mergeDistinctOutfits(
  preferred: OutfitSuggestion[],
  fallback: OutfitSuggestion[],
  count: number,
): OutfitSuggestion[] {
  const seen = new Set<string>();
  const result: OutfitSuggestion[] = [];
  for (const outfit of [...preferred, ...fallback]) {
    const key = outfit.items.map((item) => item.id).sort().join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(outfit);
    if (result.length >= count) break;
  }
  return result;
}

function assemblePureOutfits(
  tops: WardrobeItem[],
  bottoms: WardrobeItem[],
  dresses: WardrobeItem[],
  outerwear: WardrobeItem[],
  shoes: WardrobeItem[],
  ctx: StylingContext,
): OutfitSuggestion[] {
  const outfits: OutfitSuggestion[] = [];
  const needsJacket =
    ctx.temp !== undefined
      ? ctx.temp <= 14
      : ctx.weatherSeason === "winter" || ctx.weatherSeason === "fall";

  // Only consider outerwear that ACTUALLY suits the weather — don't pair a
  // winter coat with summer chinos at 26°C just because outerwear exists.
  const weatherAppropriateOuter = outerwear.filter((o) => isWeatherAppropriate(o, ctx));

  // Strategy 1: Top + Bottom combos. Iterate as top-major but rotate the
  // starting bottom per top so three outfits don't all reuse bottom #1.
  const topPool = tops.filter((t) => isWeatherAppropriate(t, ctx)).slice(0, 5);
  const bottomPool = bottoms.filter((b) => isWeatherAppropriate(b, ctx)).slice(0, 5);
  const usedBottoms = new Set<string>();

  for (const top of topPool) {
    for (let offset = 0; offset < bottomPool.length; offset++) {
      const bottom = bottomPool[(outfits.length + offset) % bottomPool.length];
      if (usedBottoms.has(bottom.id) && usedBottoms.size < bottomPool.length) continue;
      if (!colorsHarmonize(top.colorPrimary, bottom.colorPrimary)) continue;

      const items: WardrobeItem[] = [top, bottom];
      const shoe = shoes
        .filter((s) => isWeatherAppropriate(s, ctx))
        .find((s) => colorsHarmonize(s.colorPrimary, top.colorPrimary));
      if (shoe) items.push(shoe);
      else continue;

      if (needsJacket) {
        const jacket = weatherAppropriateOuter.find((o) =>
          colorsHarmonize(o.colorPrimary, top.colorPrimary),
        );
        if (jacket) items.push(jacket);
        else continue;
      }

      usedBottoms.add(bottom.id);
      outfits.push({
        name: `${top.subcategory ?? top.category} + ${bottom.subcategory ?? bottom.category}`,
        items,
        stylingTip: generateTip(items, ctx),
        confidence: 0.7,
      });
      break; // one outfit per top → more variety across suggestions
    }
    if (outfits.length >= 5) break;
  }

  // Strategy 2: Dress outfits
  for (const dress of dresses.slice(0, 3)) {
    if (!isWeatherAppropriate(dress, ctx)) continue;
    const items: WardrobeItem[] = [dress];
    const shoe = shoes
      .filter((s) => isWeatherAppropriate(s, ctx))
      .find((s) => colorsHarmonize(s.colorPrimary, dress.colorPrimary));
    if (shoe) items.push(shoe);
    else continue;

    if (needsJacket) {
      const jacket = weatherAppropriateOuter.find((o) =>
        colorsHarmonize(o.colorPrimary, dress.colorPrimary),
      );
      if (jacket) items.push(jacket);
      else continue;
    }

    outfits.push({
      name: `${dress.subcategory ?? "Dress"} outfit`,
      items,
      stylingTip: generateTip(items, ctx),
      confidence: 0.75,
    });
  }

  return outfits;
}

/**
 * Ukrainian, persona-toned styling tips for the pure-code path. The app UI
 * is Ukrainian and the persona must be felt even when Gemini isn't called —
 * otherwise 4 personas exist only on the (rare) Gemini branch.
 * Exported for tests.
 */
export function generateTip(items: WardrobeItem[], ctx: StylingContext): string {
  const persona: StylistPersona = ctx.persona ?? "classic";
  const facts: string[] = [];

  if (ctx.temp !== undefined) {
    if (ctx.temp >= 25) facts.push("легкі тканини дихають у спеку");
    else if (ctx.temp <= 5) facts.push("шари тримають тепло в холод");
  }
  if (isWetWeather(ctx)) facts.push("взуття підібране під дощ");
  if (items.some((i) => i.pattern !== "solid")) facts.push("принт додає акцент");
  if (ctx.mood.boldness > 70) facts.push("сміливе поєднання");
  else if (ctx.mood.boldness < 30) facts.push("стримана класика");

  const fact = facts[0] ?? "кольори збалансовані";

  switch (persona) {
    case "sassy":
      return `Так-так-так, ${fact} — це вже заявка на найкращий образ дня!`;
    case "manly":
      return `Норм. ${fact.charAt(0).toUpperCase()}${fact.slice(1)}. По ділу.`;
    case "kind":
      return `Сонечко, цей образ — справжня знахідка: ${fact}!`;
    case "classic":
    default:
      return `Збалансований образ: ${fact}.`;
  }
}

function fallbackOutfit(candidates: WardrobeItem[], ctx: StylingContext): OutfitSuggestion[] {
  const safe = candidates.filter((item) => isWeatherAppropriate(item, ctx));
  const groups = groupByCategory(safe);
  const top = groups.get("tops")?.[0];
  const bottom = ["bottoms", "jeans", "pants", "skirts"]
    .flatMap((category) => groups.get(category) ?? [])[0];
  const dress = groups.get("dresses")?.[0];
  const shoes = [...(groups.get("footwear") ?? []), ...(groups.get("shoes") ?? [])][0];
  const outerwear = groups.get("outerwear")?.[0];
  const needsOuterwear =
    ctx.temp !== undefined
      ? ctx.temp <= 14
      : ctx.weatherSeason === "winter" || ctx.weatherSeason === "fall";
  const base = dress ? [dress] : top && bottom ? [top, bottom] : [];
  if (base.length === 0 || (needsOuterwear && !outerwear)) return [];
  const items = [...base, ...(shoes ? [shoes] : []), ...(needsOuterwear && outerwear ? [outerwear] : [])];
  return [
    {
      name: "Образ дня",
      items,
      stylingTip: `${generateTip(items, ctx)} ${
        shoes ? "" : "Гардероб поки замалий для повного образу — додайте відповідне взуття."
      }`.trim(),
      confidence: shoes ? 0.4 : 0.25,
    },
  ];
}

function describeUserContext(ctx: StylingContext): string {
  const lines: string[] = [];
  if (ctx.colorSeason) lines.push(`- Color season: ${ctx.colorSeason}`);
  if (ctx.colorPalette && ctx.colorPalette.length > 0) {
    lines.push(`- Best colors: ${ctx.colorPalette.map((c) => c.name).join(", ")}`);
  }
  if (ctx.avoidColors && ctx.avoidColors.length > 0) {
    lines.push(`- Colors to AVOID: ${ctx.avoidColors.map((c) => c.name).join(", ")}`);
  }
  if (ctx.genderMode && ctx.genderMode !== "neutral") {
    lines.push(`- Style mode: ${ctx.genderMode}`);
  }
  return lines.length > 0 ? `\nUser profile:\n${lines.join("\n")}` : "";
}

function itemNeedsReview(tags: WardrobeItem["tags"]): boolean {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return false;
  return (tags as Record<string, unknown>).needsReview === true;
}

function itemReviewReasons(tags: WardrobeItem["tags"]): string[] {
  if (!tags || typeof tags !== "object" || Array.isArray(tags) || !("reviewReasons" in tags)) {
    return [];
  }
  const reasons = (tags as Record<string, unknown>).reviewReasons;
  return Array.isArray(reasons)
    ? reasons.filter((reason): reason is string => typeof reason === "string")
    : [];
}

function summarizeWardrobeItems(pool: WardrobeItem[]) {
  return pool.map((item, index) => ({
    index,
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    color: item.colorPrimary,
    colorHex: item.colorHex,
    pattern: item.pattern,
    fabric: item.fabric,
    season: item.season,
    formality: item.formalityLevel,
    condition: item.condition,
    timesWorn: item.timesWorn,
    lastWornAt: item.lastWornAt?.toISOString() ?? null,
    brand: item.brand,
    needsReview: itemNeedsReview(item.tags),
    reviewReasons: itemReviewReasons(item.tags),
  }));
}

export const STYLIST_V2_STYLE_DOCTRINE = `
You are Pocket Stylist's senior fashion editor: a professional personal stylist,
color analyst, wardrobe curator and practical weather-aware dresser.

Decision doctrine:
1. Start from the human: color season, best palette, avoid colors, gender mode,
   comfort/mood signals and the requested formality.
2. Then solve the day: temperature, precipitation, footwear safety, layers and
   fabric behavior. Shoes are part of the outfit, not an afterthought.
3. Then edit the wardrobe like a real closet: proportions, silhouette, texture,
   fabric weight, pattern balance, item condition, times worn and last worn.
4. Build three distinct variants when possible:
   - safe: polished, wearable, low-risk, capsule-friendly.
   - balanced: a little more styled, editorial but practical.
   - bold: one statement choice, still coherent and wearable.
5. Persona changes both selection and wording:
   classic favors timeless structure and restrained elegance;
   sassy favors one confident statement piece or sharper contrast;
   manly favors direct utility, clean lines, sturdy footwear and no fuss;
   kind favors comfort, softness, forgiving silhouettes and reassurance.

Style doctrine:
- Use 60/30/10 color balance when possible: base neutral, secondary support,
  one controlled accent. Do not build around avoid colors.
- Respect undertone: cool seasons prefer blue-based, clear or muted cool shades;
  warm seasons prefer golden, earthy or peach-based shades.
- Balance silhouette: volume on top likes cleaner bottoms; wide bottoms like a
  cleaner top; dresses need shoe/formality alignment.
- Fabric matters: linen/chiffon breathe in heat; wool/cashmere/fleece insulate;
  suede/velvet are risky in rain; leather/boots are safer in wet cold weather.
- A complete outfit must include footwear and either a dress or top+bottom.
- If the safe pool cannot create a valid outfit, return [] instead of inventing.
- Never mention hidden chain-of-thought. Return concise user-facing rationale.
`.trim();

const STYLIST_V2_RESPONSE_SCHEMA = {
  type: "array",
  maxItems: 3,
  items: {
    type: "object",
    required: [
      "variant",
      "name",
      "itemIndexes",
      "stylingTip",
      "whyItWorks",
      "weatherFit",
      "risks",
      "confidence",
    ],
    properties: {
      variant: { type: "string", enum: ["safe", "balanced", "bold"] },
      name: { type: "string" },
      itemIndexes: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: { type: "integer" },
      },
      stylingTip: { type: "string" },
      whyItWorks: { type: "string" },
      weatherFit: { type: "string" },
      risks: {
        type: "array",
        maxItems: 3,
        items: { type: "string" },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  },
} as const;

function describePersonaStrategy(persona: StylistPersona | undefined): string {
  switch (persona ?? "classic") {
    case "sassy":
      return "sassy: choose a bolder accent, print or sharper contrast when safe; wording may be playful but still premium.";
    case "manly":
      return "manly: choose practical, clean, sturdy combinations; avoid fussy styling and overly cute phrasing.";
    case "kind":
      return "kind: choose comfort-forward pieces, soft textures and forgiving silhouettes; wording should feel supportive.";
    case "classic":
    default:
      return "classic: choose timeless, balanced, polished combinations with restrained wording.";
  }
}

export function buildStylistV2Prompt(
  candidates: WardrobeItem[],
  ctx: StylingContext,
  count: number,
): string {
  const requestedVariants = (["safe", "balanced", "bold"] as const).slice(0, count);
  const tempLine =
    ctx.temp !== undefined
      ? `- Temperature: ${ctx.temp.toFixed(0)}C (${ctx.condition ?? "n/a"})`
      : "- Temperature: unknown";
  const precipLine = isWetWeather(ctx)
    ? "- Precipitation/wet ground: closed weather-safe footwear is mandatory."
    : "- Precipitation/wet ground: not expected.";

  return `${STYLIST_V2_STYLE_DOCTRINE}

Current request:
- Mood: energy ${ctx.mood.energy}/100, boldness ${ctx.mood.boldness}/100
- Weather season: ${ctx.weatherSeason}
${tempLine}
${precipLine}
- Formality range: ${ctx.formalityRange.min}-${ctx.formalityRange.max}
- Persona strategy: ${describePersonaStrategy(ctx.persona)}
${describeUserContext(ctx)}

Hard safety contract:
1. Use ONLY item indexes from Available items. Never invent, rename or imply a missing garment.
2. Every outfit must include footwear and either (top + bottom/jeans/pants/skirt) or dress.
3. At 14C or below, include outerwear.
4. Keep all items weather-safe: season must be "${ctx.weatherSeason}" or "all"; no hot fabrics in heat; no open/suede/velvet footwear in wet weather.
5. Respect avoid colors and do not use worn-out items.
6. If a wardrobe item has needsReview=true, use it only if the outfit would otherwise fail and mention the risk.
7. Return up to ${count} outfits for variants: ${requestedVariants.join(", ")}. Skip a variant if it cannot be valid.

Available items:
${JSON.stringify(summarizeWardrobeItems(candidates), null, 2)}

Return ONLY a valid JSON array, no markdown, no prose outside JSON.
Each object must have:
{
  "variant": "safe|balanced|bold",
  "name": "short outfit name in Ukrainian",
  "itemIndexes": [0, 2, 5],
  "stylingTip": "one persona-toned Ukrainian sentence, max 260 chars",
  "whyItWorks": "Ukrainian rationale: color/silhouette/formality, max 320 chars",
  "weatherFit": "Ukrainian rationale: temperature/precipitation/layers/shoes, max 240 chars",
  "risks": ["optional Ukrainian risk or caveat, max 3"],
  "confidence": 0.0
}

Reply ONLY valid JSON.`;
}

const StylistV2OutfitSchema = z.object({
  variant: z.enum(["safe", "balanced", "bold"]),
  name: z.string().trim().min(1).max(80),
  itemIndexes: z.array(z.number().int().nonnegative()).min(2).max(6),
  stylingTip: z.string().trim().min(1).max(280),
  whyItWorks: z.string().trim().min(1).max(360),
  weatherFit: z.string().trim().min(1).max(260),
  risks: z.array(z.string().trim().min(1).max(180)).max(3).catch([]),
  confidence: z.coerce.number().min(0).max(1),
});

export function parseStylistV2Outfits(
  text: string,
  pool: WardrobeItem[],
  count: number,
): OutfitSuggestion[] {
  const parsed = z
    .array(StylistV2OutfitSchema)
    .max(count)
    .parse(parseGeminiJson(text));

  return parsed.map((outfit) => ({
    name: outfit.name,
    items: mapIndexesToItems(outfit.itemIndexes, pool),
    stylingTip: outfit.stylingTip,
    confidence: outfit.confidence,
    variant: outfit.variant,
    stylistVersion: "v2",
    whyItWorks: outfit.whyItWorks,
    weatherFit: outfit.weatherFit,
    risks: outfit.risks,
  }));
}

async function geminiGenerateOutfitsV2(
  candidates: WardrobeItem[],
  ctx: StylingContext,
  count: number,
): Promise<OutfitSuggestion[]> {
  if (!isConfiguredSecret(process.env.GEMINI_API_KEY)) {
    throw new Error("Gemini API key is not configured");
  }

  const pool = candidates;
  const prompt = buildStylistV2Prompt(pool, ctx, count);

  recordGeminiUsage("outfit-generation-v2");
  const text = await generateGeminiText({
    contents: prompt,
    config: geminiJsonConfig({
      temperature: 0.55,
      responseJsonSchema: STYLIST_V2_RESPONSE_SCHEMA,
    }),
    timeoutMs: GEMINI_TIMEOUT_MS,
    timeoutMessage: "Gemini outfit generation v2 timed out",
  });

  return parseStylistV2Outfits(text, pool, count);
}

async function geminiGenerateOutfits(
  candidates: WardrobeItem[],
  ctx: StylingContext,
  count: number,
): Promise<OutfitSuggestion[]> {
  if (!isConfiguredSecret(process.env.GEMINI_API_KEY)) {
    throw new Error("Gemini API key is not configured");
  }

  // Gemini sees the full rules-filtered wardrobe, not an arbitrary prefix.
  const pool = candidates;

  // CRITICAL: include `season` and `fabric` so the model can reason about
  // weather appropriateness. Previously these were missing and Gemini would
  // happily put a wool coat into a 26 °C outfit.
  const itemSummaries = summarizeWardrobeItems(pool);

  const tempLine =
    ctx.temp !== undefined
      ? `- Temperature: ${ctx.temp.toFixed(0)}°C (${ctx.condition ?? "n/a"})`
      : `- Temperature: unknown`;
  const precipLine = isWetWeather(ctx)
    ? `- Precipitation expected: pick closed, weather-proof footwear (no sandals, no suede)`
    : "";

  const prompt = `You are a fashion stylist. Create ${count} outfit combinations from these wardrobe items.

Context:
- Mood: Energy ${ctx.mood.energy}/100, Boldness ${ctx.mood.boldness}/100
- Season: ${ctx.weatherSeason}
${tempLine}
${precipLine}
- Formality range: ${ctx.formalityRange.min}-${ctx.formalityRange.max}${describeUserContext(ctx)}

STRICT WEATHER RULES — violating these makes the outfit invalid:
1. NEVER include an item whose "season" is different from "${ctx.weatherSeason}" UNLESS its season is "all".
2. NEVER include items with fabric "fleece", "wool", "cashmere", "velvet", or "suede" when the temperature is 20°C or above.
3. NEVER include items in the "swimwear" category when the temperature is 10°C or below.
4. Prefer items matching the user's best colors; never build an outfit around a color from the AVOID list.
5. Every outfit must contain either (tops + bottoms/jeans/pants/skirts + footwear) or (dresses + footwear).
6. At 14°C or below every outfit must also contain outerwear.
7. Item indexes inside an outfit must be distinct. Never invent an index and never use an item outside this list.
8. Use at most one non-solid pattern per outfit and keep every item inside the requested formality range.
9. If you cannot build a valid outfit under these rules, return an EMPTY ARRAY [] — do not invent items.

Available items:
${JSON.stringify(itemSummaries, null, 2)}

Return ONLY valid JSON array (no markdown fences):
[{
  "name": "outfit name",
  "itemIndexes": [0, 2, 5],
  "stylingTip": "why this works for the weather and mood (in Ukrainian)",
  "confidence": 0.8
}]

Reply ONLY valid JSON. No markdown, no explanation.`;

  // Persona affects ONLY the stylingTip voice. Item selection, JSON schema
  // and the trailing JSON-only instruction in `prompt` stay intact because
  // applyPersona prepends rather than rewrites.
  const finalPrompt = applyPersona(prompt, ctx.persona ?? "classic");

  recordGeminiUsage("outfit-generation");
  const text = await generateGeminiText({
    contents: finalPrompt,
    config: geminiJsonConfig({
      temperature: 0.4,
    }),
    timeoutMs: GEMINI_TIMEOUT_MS,
    timeoutMessage: "Gemini outfit generation timed out",
  });
  const parsed = z
    .array(
      z.object({
        name: z.string().trim().min(1).max(50),
        itemIndexes: z.array(z.number().int().nonnegative()).min(2).max(6),
        stylingTip: z.string().trim().min(1).max(200),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(count)
    .parse(parseGeminiJson(text));

  return parsed.map((outfit) => ({
    name: outfit.name,
    items: mapIndexesToItems(outfit.itemIndexes, pool),
    stylingTip: outfit.stylingTip,
    confidence: outfit.confidence,
    stylistVersion: "v1",
  }));
}
