import { GoogleGenerativeAI } from "@google/generative-ai";
import type { WardrobeItem } from "../../../src/generated/prisma/client.js";
import { scoreItem, groupByCategory, colorsHarmonize } from "./rules-engine.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

interface OutfitSuggestion {
  name: string;
  items: WardrobeItem[];
  stylingTip: string;
  confidence: number;
}

interface StylingContext {
  mood: { energy: number; boldness: number };
  weatherSeason: string;
  formalityRange: { min: number; max: number };
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

  const groups = groupByCategory(candidates);
  const tops = groups.get("tops") ?? [];
  const bottoms = groups.get("bottoms") ?? [];
  const dresses = groups.get("dresses") ?? [];
  const outerwear = groups.get("outerwear") ?? [];
  const shoes = groups.get("shoes") ?? [];

  // Try pure-code assembly first
  const pureOutfits = assemblePureOutfits(tops, bottoms, dresses, outerwear, shoes, ctx);

  if (pureOutfits.length >= count) {
    return pureOutfits.slice(0, count);
  }

  // Fall back to Gemini for creative suggestions
  try {
    const geminiOutfits = await geminiGenerateOutfits(candidates, ctx, count);
    return geminiOutfits;
  } catch (err) {
    console.error("Gemini outfit generation failed:", err);
    // Return whatever we have from pure-code
    return pureOutfits.length > 0 ? pureOutfits : fallbackOutfit(candidates);
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

  // Strategy 1: Top + Bottom combos
  for (const top of tops.slice(0, 5)) {
    for (const bottom of bottoms.slice(0, 5)) {
      if (!colorsHarmonize(top.colorPrimary, bottom.colorPrimary)) continue;

      const items: WardrobeItem[] = [top, bottom];
      const shoe = shoes.find((s) => colorsHarmonize(s.colorPrimary, top.colorPrimary));
      if (shoe) items.push(shoe);

      if (ctx.weatherSeason === "winter" || ctx.weatherSeason === "fall") {
        const jacket = outerwear.find((o) =>
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
    const items: WardrobeItem[] = [dress];
    const shoe = shoes.find((s) => colorsHarmonize(s.colorPrimary, dress.colorPrimary));
    if (shoe) items.push(shoe);

    if (ctx.weatherSeason === "winter" || ctx.weatherSeason === "fall") {
      const jacket = outerwear.find((o) =>
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

  return tips.join(" ") || "A well-balanced outfit for today.";
}

function fallbackOutfit(candidates: WardrobeItem[]): OutfitSuggestion[] {
  if (candidates.length === 0) return [];
  return [
    {
      name: "Today's Pick",
      items: candidates.slice(0, Math.min(3, candidates.length)),
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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const itemSummaries = candidates.slice(0, 30).map((item, i) => ({
    index: i,
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    color: item.colorPrimary,
    pattern: item.pattern,
    fabric: item.fabric,
    formality: item.formalityLevel,
  }));

  const prompt = `You are a fashion stylist. Create ${count} outfit combinations from these wardrobe items.

Context:
- Mood: Energy ${ctx.mood.energy}/100, Boldness ${ctx.mood.boldness}/100
- Season: ${ctx.weatherSeason}
- Formality range: ${ctx.formalityRange.min}-${ctx.formalityRange.max}

Available items:
${JSON.stringify(itemSummaries, null, 2)}

Return ONLY valid JSON array (no markdown fences):
[{
  "name": "outfit name",
  "itemIndexes": [0, 2, 5],
  "stylingTip": "why this works",
  "confidence": 0.8
}]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(json) as Array<{
    name: string;
    itemIndexes: number[];
    stylingTip: string;
    confidence: number;
  }>;

  return parsed.map((outfit) => ({
    name: outfit.name,
    items: outfit.itemIndexes
      .filter((i) => i >= 0 && i < candidates.length)
      .map((i) => candidates[i]),
    stylingTip: outfit.stylingTip,
    confidence: outfit.confidence,
  }));
}
