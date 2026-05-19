import type { WardrobeItem } from "../../../src/generated/prisma/client.js";

interface ColorEntry {
  name: string;
  hex: string;
}

interface StylingContext {
  mood: { energy: number; boldness: number };
  weatherSeason: string;
  /** Real ambient temperature in °C — used by fabric/category temperature filters. */
  temp?: number;
  formalityRange: { min: number; max: number };
  avoidRecentDays?: number;
  colorPalette?: ColorEntry[];
  avoidColors?: ColorEntry[];
}

/**
 * Fabrics that are physically too warm for hot weather. If the user has a
 * fleece tracksuit and the forecast says 28°C, we never want to surface it
 * as a candidate — the Gemini prompt is also told to avoid these, but this
 * is the belt-and-braces server-side guard.
 */
const HOT_WEATHER_BLOCKED_FABRICS = new Set([
  "fleece",
  "wool",
  "cashmere",
  "velvet",
  "suede",
]);

/**
 * Inverse: fabrics that don't belong in cold weather (silk dresses,
 * chiffon blouses). Less aggressive than the hot-weather list because
 * layering is a thing.
 */
const COLD_WEATHER_BLOCKED_CATEGORIES = new Set(["swimwear"]);

// Pure-code rules engine — no Gemini needed, unlimited usage
export function filterWardrobe(
  items: WardrobeItem[],
  ctx: StylingContext,
): WardrobeItem[] {
  const now = Date.now();
  const recentMs = (ctx.avoidRecentDays ?? 7) * 24 * 60 * 60 * 1000;
  const temp = ctx.temp;

  return items.filter((item) => {
    // Season filter
    if (item.season !== "all" && item.season !== ctx.weatherSeason) return false;

    // Hot-weather guard: at +20°C and above, exclude obviously heavy fabrics.
    if (temp !== undefined && temp >= 20 && item.fabric && HOT_WEATHER_BLOCKED_FABRICS.has(item.fabric)) {
      return false;
    }
    // Cold-weather guard: at <=10°C, exclude swimwear.
    if (temp !== undefined && temp <= 10 && COLD_WEATHER_BLOCKED_CATEGORIES.has(item.category)) {
      return false;
    }

    // Formality filter
    if (item.formalityLevel < ctx.formalityRange.min) return false;
    if (item.formalityLevel > ctx.formalityRange.max) return false;

    // Anti-repeat: skip items worn in last N days
    if (item.lastWornAt) {
      const lastWorn = new Date(item.lastWornAt).getTime();
      if (now - lastWorn < recentMs) return false;
    }

    return true;
  });
}

export { HOT_WEATHER_BLOCKED_FABRICS, COLD_WEATHER_BLOCKED_CATEGORIES };

export function scoreItem(
  item: WardrobeItem,
  ctx: StylingContext,
): number {
  let score = 50;

  // Bold mood → prefer bold colors and patterns
  if (ctx.mood.boldness > 60) {
    if (item.pattern !== "solid") score += 15;
    if (["red", "orange", "yellow", "purple", "pink"].includes(item.colorPrimary)) {
      score += 10;
    }
  } else if (ctx.mood.boldness < 40) {
    if (item.pattern === "solid") score += 10;
    if (["black", "white", "grey", "navy", "beige"].includes(item.colorPrimary)) {
      score += 10;
    }
  }

  // High energy → activewear bonus, low energy → comfort bonus
  if (ctx.mood.energy > 70) {
    if (item.category === "activewear") score += 15;
    if (item.fabric === "cotton" || item.fabric === "knit") score += 5;
  } else if (ctx.mood.energy < 30) {
    if (item.fabric === "fleece" || item.fabric === "knit" || item.fabric === "cashmere") {
      score += 10;
    }
  }

  // Less-worn items get a bonus to encourage rotation
  if (item.timesWorn < 3) score += 10;
  if (item.timesWorn > 20) score -= 5;

  // High confidence items preferred
  score += item.confidence * 10;

  // Color palette bonus: items matching user's best colors get +15
  if (ctx.colorPalette && ctx.colorPalette.length > 0) {
    const itemColor = item.colorPrimary.toLowerCase();
    const matchesPalette = ctx.colorPalette.some(
      (c) => c.name.toLowerCase() === itemColor,
    );
    if (matchesPalette) score += 15;
  }

  // Avoid colors penalty: items matching colors to avoid get -10
  if (ctx.avoidColors && ctx.avoidColors.length > 0) {
    const itemColor = item.colorPrimary.toLowerCase();
    const matchesAvoid = ctx.avoidColors.some(
      (c) => c.name.toLowerCase() === itemColor,
    );
    if (matchesAvoid) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

export function groupByCategory(items: WardrobeItem[]): Map<string, WardrobeItem[]> {
  const groups = new Map<string, WardrobeItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return groups;
}

// Simple color harmony check — are two colors compatible?
const COLOR_FAMILIES: Record<string, string[]> = {
  neutral: ["black", "white", "grey", "beige", "cream", "tan", "navy"],
  warm: ["red", "orange", "yellow", "burgundy", "brown", "gold"],
  cool: ["blue", "light-blue", "green", "purple", "lavender", "silver"],
  accent: ["pink", "olive", "multicolor"],
};

function getColorFamily(color: string): string {
  for (const [family, colors] of Object.entries(COLOR_FAMILIES)) {
    if (colors.includes(color)) return family;
  }
  return "neutral";
}

export function colorsHarmonize(color1: string, color2: string): boolean {
  const f1 = getColorFamily(color1);
  const f2 = getColorFamily(color2);

  // Neutrals go with everything
  if (f1 === "neutral" || f2 === "neutral") return true;
  // Same family works
  if (f1 === f2) return true;
  // Accent goes with neutrals (handled above) but not great with strong colors
  if (f1 === "accent" || f2 === "accent") return false;
  // Warm + cool can work but with lower score
  return true;
}
