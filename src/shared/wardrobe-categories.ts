/**
 * Single source of truth for clothing categories.
 *
 * Used by:
 *   - server/services/gemini.ts (Vision prompt + Zod validation)
 *   - server/api/import.ts (ingest + edit Zod schemas)
 *   - src/components/import/* and src/pages/WardrobePage.tsx (UI)
 *
 * Adding a new section is a single-file change here.
 */

export const WARDROBE_CATEGORIES = [
  "tops",
  "bottoms",
  "jeans",
  "pants",
  "skirts",
  "dresses",
  "outerwear",
  "footwear",
  "swimwear",
  "pajamas",
  "underwear",
  "accessories",
  "sportswear",
  "suits",
] as const;

export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

/**
 * Legacy → canonical aliases.
 *
 * Older rows in the database may still hold the previous category strings
 * (e.g. "shoes" before we renamed to "footwear"). normalizeCategory keeps
 * those rows usable in filters/UI without a destructive data migration.
 */
const CATEGORY_ALIASES: Record<string, WardrobeCategory> = {
  shoes: "footwear",
  shoe: "footwear",
  activewear: "sportswear",
  sleepwear: "pajamas",
  lingerie: "underwear",
  jewelry: "accessories",
  blazer: "suits",
  blazers: "suits",
  "suit jacket": "suits",
  "sport coat": "suits",
  "sports coat": "suits",
  "dinner jacket": "suits",
  tuxedo: "suits",
  tux: "suits",
  jacket: "outerwear",
  coat: "outerwear",
  parka: "outerwear",
  puffer: "outerwear",
  trench: "outerwear",
  raincoat: "outerwear",
  windbreaker: "outerwear",
  bomber: "outerwear",
  overshirt: "tops",
  shirt: "tops",
  blouse: "tops",
  "t-shirt": "tops",
  tshirt: "tops",
  tee: "tops",
  trousers: "pants",
  chinos: "pants",
  slacks: "pants",
  joggers: "pants",
  shorts: "bottoms",
};

export function normalizeCategory(value: string | null | undefined): WardrobeCategory {
  if (!value) return "tops";
  const lower = value.toLowerCase().trim();
  if ((WARDROBE_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as WardrobeCategory;
  }
  return CATEGORY_ALIASES[lower] ?? "tops";
}

export function isWardrobeCategory(value: unknown): value is WardrobeCategory {
  return typeof value === "string" && (WARDROBE_CATEGORIES as readonly string[]).includes(value);
}
