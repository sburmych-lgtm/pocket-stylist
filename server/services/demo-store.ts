import { randomUUID } from "node:crypto";
import type { WardrobeItem } from "../../src/generated/prisma/client.js";

export const DEMO_USER_ID = "demo-user";
export const DEMO_USER_EMAIL = "demo@pocket-stylist.app";

export const DEMO_USER = {
  id: DEMO_USER_ID,
  email: DEMO_USER_EMAIL,
  name: "Demo User",
  avatarUrl: null,
  genderMode: "neutral",
  colorSeason: null,
  colorPalette: null,
  avoidColors: null,
};

const wardrobeItems = new Map<string, WardrobeItem[]>();
const seeded = new Set<string>();

export function isDemoUser(userId: string | undefined): boolean {
  return userId === DEMO_USER_ID;
}

/**
 * Build a flat SVG data-URL so we can preview seed items without depending
 * on an external CDN (which would defeat the whole "demo without setup"
 * promise). The shape is just a colored rectangle with the category text —
 * the real value is downstream: the outfit engine + analytics surface
 * something to interact with from minute zero.
 */
function svgPlaceholder(color: string, label: string): string {
  const safeLabel = label.replace(/[<>&]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="${color}"/><text x="200" y="260" font-family="system-ui,sans-serif" font-size="22" fill="white" text-anchor="middle" opacity="0.9">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEMO_SEED = [
  { category: "tops", subcategory: "T-Shirt", colorPrimary: "white", colorHex: "#F5F5F5", pattern: "solid", fabric: "cotton", season: "summer", formalityLevel: 2, confidence: 0.92, brand: "Demo Basics" },
  { category: "tops", subcategory: "Linen Shirt", colorPrimary: "beige", colorHex: "#D7C6A4", pattern: "solid", fabric: "linen", season: "summer", formalityLevel: 3, confidence: 0.88, brand: "Demo Basics" },
  { category: "jeans", subcategory: "Straight Jeans", colorPrimary: "blue", colorHex: "#3A5775", pattern: "solid", fabric: "denim", season: "all", formalityLevel: 2, confidence: 0.94, brand: null },
  { category: "pants", subcategory: "Chinos", colorPrimary: "beige", colorHex: "#A1855E", pattern: "solid", fabric: "cotton", season: "all", formalityLevel: 3, confidence: 0.89, brand: null },
  { category: "dresses", subcategory: "Wrap Dress", colorPrimary: "navy", colorHex: "#1E2A47", pattern: "solid", fabric: "silk", season: "summer", formalityLevel: 4, confidence: 0.86, brand: "Demo Atelier" },
  { category: "outerwear", subcategory: "Wool Coat", colorPrimary: "black", colorHex: "#1A1A1A", pattern: "solid", fabric: "wool", season: "winter", formalityLevel: 4, confidence: 0.93, brand: null },
  { category: "footwear", subcategory: "Leather Sneakers", colorPrimary: "white", colorHex: "#EFEEEA", pattern: "solid", fabric: "leather", season: "all", formalityLevel: 2, confidence: 0.91, brand: "Demo Sport" },
  { category: "footwear", subcategory: "Ankle Boots", colorPrimary: "brown", colorHex: "#4F2E16", pattern: "solid", fabric: "leather", season: "fall", formalityLevel: 3, confidence: 0.87, brand: null },
  { category: "accessories", subcategory: "Silk Scarf", colorPrimary: "burgundy", colorHex: "#7A1C2E", pattern: "abstract", fabric: "silk", season: "all", formalityLevel: 4, confidence: 0.81, brand: null },
  { category: "sportswear", subcategory: "Running Tights", colorPrimary: "black", colorHex: "#0E0E0F", pattern: "solid", fabric: "polyester", season: "all", formalityLevel: 1, confidence: 0.85, brand: "Demo Sport" },
] as const;

/**
 * Seed the in-memory wardrobe for a demo user with ~10 realistic items.
 * Called from /api/auth/demo on every login but idempotent: once the
 * user has any items (seeded or imported) we don't add more. This makes
 * the demo feel like a real customer the moment they land on /styling.
 */
export function ensureDemoSeed(userId: string): void {
  if (seeded.has(userId)) return;
  if ((wardrobeItems.get(userId)?.length ?? 0) > 0) {
    seeded.add(userId);
    return;
  }
  addDemoWardrobeItems(
    userId,
    DEMO_SEED.map((item) => ({
      ...item,
      imageUrl: svgPlaceholder(item.colorHex, item.subcategory),
      thumbnailUrl: svgPlaceholder(item.colorHex, item.subcategory),
    })),
  );
  seeded.add(userId);
}

export function getDemoWardrobe(userId: string): WardrobeItem[] {
  ensureDemoSeed(userId);
  return [...(wardrobeItems.get(userId) ?? [])].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export function addDemoWardrobeItems(
  userId: string,
  items: Array<{
    imageUrl: string;
    thumbnailUrl?: string | null;
    category: string;
    subcategory?: string | null;
    colorPrimary: string;
    colorHex?: string | null;
    pattern?: string | null;
    fabric?: string | null;
    formalityLevel?: number | null;
    season?: string | null;
    brand?: string | null;
    confidence?: number | null;
  }>,
): number {
  const existing = wardrobeItems.get(userId) ?? [];
  const now = new Date();
  const created = items.map((item): WardrobeItem => ({
    id: randomUUID(),
    userId,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl ?? null,
    category: item.category,
    subcategory: item.subcategory ?? null,
    colorPrimary: item.colorPrimary,
    colorHex: item.colorHex ?? null,
    pattern: item.pattern ?? "solid",
    fabric: item.fabric ?? null,
    formalityLevel: item.formalityLevel ?? 3,
    season: item.season ?? "all",
    brand: item.brand ?? null,
    price: null,
    condition: "good",
    confidence: item.confidence ?? 0,
    timesWorn: 0,
    lastWornAt: null,
    purchasedAt: null,
    tags: null,
    createdAt: now,
    updatedAt: now,
  }));

  wardrobeItems.set(userId, [...created, ...existing]);
  return created.length;
}

export function deleteDemoWardrobeItem(userId: string, itemId: string): boolean {
  const existing = wardrobeItems.get(userId) ?? [];
  const next = existing.filter((item) => item.id !== itemId);
  wardrobeItems.set(userId, next);
  return next.length !== existing.length;
}

export function updateDemoWardrobeItem(
  userId: string,
  itemId: string,
  patch: Partial<{
    category: string;
    subcategory: string | null;
    colorPrimary: string;
    colorHex: string | null;
    pattern: string;
    fabric: string | null;
    formalityLevel: number;
    season: string;
    brand: string | null;
  }>,
): WardrobeItem | null {
  const existing = wardrobeItems.get(userId) ?? [];
  const idx = existing.findIndex((item) => item.id === itemId);
  if (idx === -1) return null;
  const before = existing[idx];
  const updated: WardrobeItem = {
    ...before,
    category: patch.category ?? before.category,
    subcategory: patch.subcategory === undefined ? before.subcategory : patch.subcategory,
    colorPrimary: patch.colorPrimary ?? before.colorPrimary,
    colorHex: patch.colorHex === undefined ? before.colorHex : patch.colorHex,
    pattern: patch.pattern ?? before.pattern,
    fabric: patch.fabric === undefined ? before.fabric : patch.fabric,
    formalityLevel: patch.formalityLevel ?? before.formalityLevel,
    season: patch.season ?? before.season,
    brand: patch.brand === undefined ? before.brand : patch.brand,
    updatedAt: new Date(),
  };
  const next = [...existing];
  next[idx] = updated;
  wardrobeItems.set(userId, next);
  return updated;
}
