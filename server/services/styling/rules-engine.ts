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
  /** Weather descriptor ("Clear" | "Clouds" | "Rain" | "Showers" | "Snow" | ...). */
  condition?: string;
  /** Expected precipitation in mm — drives the wet-weather footwear gate. */
  precipMm?: number;
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
const COLD_WEATHER_BLOCKED_FABRICS = new Set(["chiffon", "mesh", "linen"]);

function normalizeColorName(value: string): string {
  return value.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/giu, " ").trim();
}

function colorEntryMatches(
  item: Pick<WardrobeItem, "colorPrimary" | "colorHex">,
  entry: ColorEntry,
): boolean {
  if (
    item.colorHex &&
    entry.hex &&
    item.colorHex.toLowerCase() === entry.hex.toLowerCase()
  ) {
    return true;
  }
  const itemName = normalizeColorName(item.colorPrimary);
  const entryName = normalizeColorName(entry.name);
  return (
    itemName === entryName ||
    entryName.split(" ").includes(itemName) ||
    itemName.split(" ").includes(entryName)
  );
}

/** Conditions that count as "wet" for the footwear gate. */
const WET_CONDITIONS = new Set(["Rain", "Showers", "Thunderstorm", "Snow"]);

/**
 * Open-toe / fair-weather footwear that should never be suggested in rain
 * or snow. Matched against the free-text `subcategory` (Gemini writes
 * values like "sandals", "flip-flops", "espadrilles"; users may edit in
 * Ukrainian).
 */
const WET_BLOCKED_FOOTWEAR_SUBCATEGORY =
  /sandal|flip[- ]?flop|slide|slipper|espadrille|mule|сандал|шльопан|в'єтнам|капц/i;

/** Suede/velvet footwear is ruined by rain — block those fabrics too. */
const WET_BLOCKED_FOOTWEAR_FABRICS = new Set(["suede", "velvet"]);

export function isWetWeather(ctx: Pick<StylingContext, "condition" | "precipMm">): boolean {
  if (ctx.condition && WET_CONDITIONS.has(ctx.condition)) return true;
  return typeof ctx.precipMm === "number" && ctx.precipMm >= 1;
}

/**
 * Precipitation → footwear gate. Returns false for footwear that must not
 * be worn in wet weather. Non-footwear items always pass.
 */
export function isFootwearWeatherOk(
  item: Pick<WardrobeItem, "category" | "subcategory" | "fabric">,
  ctx: Pick<StylingContext, "condition" | "precipMm">,
): boolean {
  if (item.category !== "footwear" && item.category !== "shoes") return true;
  if (!isWetWeather(ctx)) return true;
  if (item.fabric && WET_BLOCKED_FOOTWEAR_FABRICS.has(item.fabric)) return false;
  if (item.subcategory && WET_BLOCKED_FOOTWEAR_SUBCATEGORY.test(item.subcategory)) return false;
  return true;
}

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
    if (item.condition === "worn") return false;
    if (ctx.avoidColors?.some((entry) => colorEntryMatches(item, entry))) return false;

    // Hot-weather guard: at +20°C and above, exclude obviously heavy fabrics.
    if (temp !== undefined && temp >= 20 && item.fabric && HOT_WEATHER_BLOCKED_FABRICS.has(item.fabric)) {
      return false;
    }
    // Cold-weather guard: at <=10°C, exclude swimwear.
    if (temp !== undefined && temp <= 10 && COLD_WEATHER_BLOCKED_CATEGORIES.has(item.category)) {
      return false;
    }
    if (
      temp !== undefined &&
      temp <= 5 &&
      item.fabric &&
      COLD_WEATHER_BLOCKED_FABRICS.has(item.fabric.toLowerCase())
    ) {
      return false;
    }

    // Precipitation guard: no sandals/suede footwear in rain or snow.
    if (!isFootwearWeatherOk(item, ctx)) return false;

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

  // High energy → sportswear bonus, low energy → comfort bonus
  // ("sportswear" is the canonical category; "activewear" is its legacy alias
  //  that can still exist on old DB rows.)
  if (ctx.mood.energy > 70) {
    if (item.category === "sportswear" || item.category === "activewear") score += 15;
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

  // Wet weather → boots earn a bonus so they outrank fair-weather shoes.
  if (
    (item.category === "footwear" || item.category === "shoes") &&
    isWetWeather(ctx) &&
    item.subcategory &&
    /boot|чобіт|черевик/i.test(item.subcategory)
  ) {
    score += 12;
  }

  // Color palette bonus: items matching user's best colors get +15
  if (ctx.colorPalette && ctx.colorPalette.length > 0) {
    const matchesPalette = ctx.colorPalette.some((entry) =>
      colorEntryMatches(item, entry),
    );
    if (matchesPalette) score += 15;
  }

  // Avoid colors penalty: items matching colors to avoid get -10
  if (ctx.avoidColors && ctx.avoidColors.length > 0) {
    const matchesAvoid = ctx.avoidColors.some((entry) =>
      colorEntryMatches(item, entry),
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
