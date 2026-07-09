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

interface ColorEntry {
  name: string;
  hex: string;
}

interface OutfitSuggestion {
  name: string;
  items: WardrobeItem[];
  stylingTip: string;
  confidence: number;
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

// Attempt pure-code outfit assembly first, fall back to Gemini
export async function generateOutfits(
  candidates: WardrobeItem[],
  ctx: StylingContext,
  count: number = 3,
  options: { useAi?: boolean } = {},
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
    return rulesOnly.slice(0, count);
  }

  try {
    const geminiOutfits = await geminiGenerateOutfits(sortedCandidates, ctx, count);
    const safeOutfits = geminiOutfits.filter((outfit) =>
      isCompleteOutfit(outfit.items, ctx) &&
      outfit.items.every((item) => isWeatherAppropriate(item, ctx)) &&
      hasCompatibleColors(outfit.items) &&
      outfit.items.filter((item) => item.pattern !== "solid").length <= 1,
    );
    const merged = mergeDistinctOutfits(safeOutfits, pureOutfits, count);
    return merged.length > 0
      ? merged
      : fallbackOutfit(sortedCandidates, ctx).slice(0, count);
  } catch (err) {
    if (isConfiguredSecret(process.env.GEMINI_API_KEY)) {
      console.error("Gemini outfit generation failed:", err);
    }
    const fallback = pureOutfits.length > 0
      ? pureOutfits
      : fallbackOutfit(sortedCandidates, ctx);
    return fallback.slice(0, count).map((outfit) => ({
      ...outfit,
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
  const itemSummaries = pool.map((item, i) => ({
    index: i,
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    color: item.colorPrimary,
    pattern: item.pattern,
    fabric: item.fabric,
    season: item.season,
    formality: item.formalityLevel,
    condition: item.condition,
    timesWorn: item.timesWorn,
    lastWornAt: item.lastWornAt?.toISOString() ?? null,
  }));

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
  }));
}
