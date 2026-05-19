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

export function isDemoUser(userId: string | undefined): boolean {
  return userId === DEMO_USER_ID;
}

export function getDemoWardrobe(userId: string): WardrobeItem[] {
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
