import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { WardrobeItem } from "../../../src/generated/prisma/client.js";
import { isConfiguredSecret } from "../app-status.js";
import { parseGeminiJson, withTimeout } from "../gemini-utils.js";
import {
  scoreItem,
  groupByCategory,
  colorsHarmonize,
  HOT_WEATHER_BLOCKED_FABRICS,
  COLD_WEATHER_BLOCKED_CATEGORIES,
} from "./rules-engine.js";
import { applyPersona, type StylistPersona } from "./personas.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const GEMINI_TIMEOUT_MS = 10_000;

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
  formalityRange: { min: number; max: number };
  /** Voice/tone persona for stylingTip copy. Selection logic unaffected. */
  persona?: StylistPersona;
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
  return true;
}

// Attempt pure-code outfit assembly first, fall back to Gemini
export async function generateOutfits(
  candidates: WardrobeItem[],
  ctx: StylingContext,
  count: number = 3,
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
  const shoes = groups.get("footwear") ?? groups.get("shoes") ?? [];

  // Try pure-code assembly first
  const pureOutfits = assemblePureOutfits(tops, bottoms, dresses, outerwear, shoes, ctx);

  if (pureOutfits.length >= count) {
    return pureOutfits.slice(0, count);
  }

  // Fall back to Gemini for creative suggestions
  try {
    const geminiOutfits = await geminiGenerateOutfits(candidates, ctx, count);
    // Validate every item Gemini returned actually matches the weather —
    // if it slipped in a winter coat for a summer day, drop the outfit.
    const safeOutfits = geminiOutfits.filter((o) =>
      o.items.length > 0 && o.items.every((it) => isWeatherAppropriate(it, ctx)),
    );
    return safeOutfits.length > 0 ? safeOutfits : pureOutfits;
  } catch (err) {
    console.error("Gemini outfit generation failed:", err);
    // Return whatever we have from pure-code
    return pureOutfits.length > 0 ? pureOutfits : fallbackOutfit(candidates, ctx);
  }
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

  // Strategy 1: Top + Bottom combos
  for (const top of tops.slice(0, 5)) {
    if (!isWeatherAppropriate(top, ctx)) continue;
    for (const bottom of bottoms.slice(0, 5)) {
      if (!isWeatherAppropriate(bottom, ctx)) continue;
      if (!colorsHarmonize(top.colorPrimary, bottom.colorPrimary)) continue;

      const items: WardrobeItem[] = [top, bottom];
      const shoe = shoes
        .filter((s) => isWeatherAppropriate(s, ctx))
        .find((s) => colorsHarmonize(s.colorPrimary, top.colorPrimary));
      if (shoe) items.push(shoe);

      if (needsJacket) {
        const jacket = weatherAppropriateOuter.find((o) =>
          colorsHarmonize(o.colorPrimary, top.colorPrimary),
        );
        if (jacket) items.push(jacket);
      }

      outfits.push({
        name: `${top.subcategory ?? top.category} + ${bottom.subcategory ?? bottom.category}`,
        items,
        stylingTip: generateTip(items, ctx),
        confidence: 0.7,
      });

      if (outfits.length >= 5) break;
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

    if (needsJacket) {
      const jacket = weatherAppropriateOuter.find((o) =>
        colorsHarmonize(o.colorPrimary, dress.colorPrimary),
      );
      if (jacket) items.push(jacket);
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

function generateTip(items: WardrobeItem[], ctx: StylingContext): string {
  const tips: string[] = [];

  if (ctx.mood.energy > 70) tips.push("Perfect for an active day!");
  else if (ctx.mood.energy < 30) tips.push("Cozy and comfortable.");

  if (ctx.mood.boldness > 70) tips.push("A bold, eye-catching look.");
  else if (ctx.mood.boldness < 30) tips.push("Clean and understated.");

  const hasPattern = items.some((i) => i.pattern !== "solid");
  if (hasPattern) tips.push("The pattern adds visual interest.");

  if (ctx.temp !== undefined) {
    if (ctx.temp >= 25) tips.push("Breathable for warm weather.");
    else if (ctx.temp <= 5) tips.push("Layered for cold conditions.");
  }

  return tips.join(" ") || "A well-balanced outfit for today.";
}

function fallbackOutfit(candidates: WardrobeItem[], ctx: StylingContext): OutfitSuggestion[] {
  const safe = candidates.filter((it) => isWeatherAppropriate(it, ctx));
  const pool = safe.length > 0 ? safe : [];
  if (pool.length === 0) return [];
  return [
    {
      name: "Today's Pick",
      items: pool.slice(0, Math.min(3, pool.length)),
      stylingTip: "Mix and match from your wardrobe.",
      confidence: 0.3,
    },
  ];
}

async function geminiGenerateOutfits(
  candidates: WardrobeItem[],
  ctx: StylingContext,
  count: number,
): Promise<OutfitSuggestion[]> {
  if (!isConfiguredSecret(process.env.GEMINI_API_KEY)) {
    throw new Error("Gemini API key is not configured");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // CRITICAL: include `season` and `fabric` so the model can reason about
  // weather appropriateness. Previously these were missing and Gemini would
  // happily put a wool coat into a 26 °C outfit.
  const itemSummaries = candidates.slice(0, 30).map((item, i) => ({
    index: i,
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    color: item.colorPrimary,
    pattern: item.pattern,
    fabric: item.fabric,
    season: item.season,
    formality: item.formalityLevel,
  }));

  const tempLine =
    ctx.temp !== undefined
      ? `- Temperature: ${ctx.temp.toFixed(0)}°C (${ctx.condition ?? "n/a"})`
      : `- Temperature: unknown`;

  const prompt = `You are a fashion stylist. Create ${count} outfit combinations from these wardrobe items.

Context:
- Mood: Energy ${ctx.mood.energy}/100, Boldness ${ctx.mood.boldness}/100
- Season: ${ctx.weatherSeason}
${tempLine}
- Formality range: ${ctx.formalityRange.min}-${ctx.formalityRange.max}

STRICT WEATHER RULES — violating these makes the outfit invalid:
1. NEVER include an item whose "season" is different from "${ctx.weatherSeason}" UNLESS its season is "all".
2. NEVER include items with fabric "fleece", "wool", "cashmere", "velvet", or "suede" when the temperature is 20°C or above.
3. NEVER include items in the "swimwear" category when the temperature is 10°C or below.
4. If you cannot build a valid outfit under these rules, return an EMPTY ARRAY [] — do not invent items.

Available items:
${JSON.stringify(itemSummaries, null, 2)}

Return ONLY valid JSON array (no markdown fences):
[{
  "name": "outfit name",
  "itemIndexes": [0, 2, 5],
  "stylingTip": "why this works for the weather and mood",
  "confidence": 0.8
}]

Reply ONLY valid JSON. No markdown, no explanation.`;

  // Persona affects ONLY the stylingTip voice. Item selection, JSON schema
  // and the trailing JSON-only instruction in `prompt` stay intact because
  // applyPersona prepends rather than rewrites.
  const finalPrompt = applyPersona(prompt, ctx.persona ?? "classic");

  const result = await withTimeout(
    model.generateContent(finalPrompt),
    GEMINI_TIMEOUT_MS,
    "Gemini outfit generation timed out",
  );
  const text = result.response.text().trim();
  const parsed = z.array(z.object({
    name: z.string().min(1).catch("Outfit"),
    itemIndexes: z.array(z.coerce.number().int()).catch([]),
    stylingTip: z.string().catch("A balanced outfit from your wardrobe."),
    confidence: z.coerce.number().min(0).max(1).catch(0.5),
  })).parse(parseGeminiJson(text));

  return parsed.map((outfit) => ({
    name: outfit.name,
    items: outfit.itemIndexes
      .filter((i) => i >= 0 && i < candidates.length)
      .map((i) => candidates[i]),
    stylingTip: outfit.stylingTip,
    confidence: outfit.confidence,
  }));
}
