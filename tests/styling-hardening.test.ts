import test from "node:test";
import assert from "node:assert/strict";
import type { WardrobeItem } from "../src/generated/prisma/client.js";
import { OutfitFeedbackSchema, SuggestBodySchema } from "../server/api/styling.js";
import {
  generateOutfits,
  mapIndexesToItems,
} from "../server/services/styling/outfit-generator.js";
import {
  filterWardrobe,
  scoreItem,
} from "../server/services/styling/rules-engine.js";

const BASE_CONTEXT = {
  mood: { energy: 50, boldness: 50 },
  weatherSeason: "winter",
  temp: 2,
  condition: "Clear",
  precipMm: 0,
  formalityRange: { min: 1, max: 5 },
};

function wardrobeItem(
  id: string,
  overrides: Partial<WardrobeItem> = {},
): WardrobeItem {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    userId: "user-1",
    imageUrl: `https://example.test/${id}.jpg`,
    thumbnailUrl: null,
    category: "tops",
    subcategory: "shirt",
    colorPrimary: "navy",
    colorHex: "#000080",
    pattern: "solid",
    fabric: "cotton",
    formalityLevel: 3,
    season: "all",
    brand: null,
    price: null,
    condition: "good",
    confidence: 0.8,
    timesWorn: 0,
    lastWornAt: null,
    purchasedAt: null,
    tags: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function suggestBody(overrides: Record<string, unknown> = {}) {
  return {
    mood: { energy: 50, boldness: 50 },
    ...overrides,
  };
}

test("SuggestBodySchema requires lat and lon as an atomic pair", () => {
  assert.equal(
    SuggestBodySchema.safeParse(suggestBody({ lat: 50.45 })).success,
    false,
    "lat without lon must be rejected",
  );
  assert.equal(
    SuggestBodySchema.safeParse(suggestBody({ lon: 30.52 })).success,
    false,
    "lon without lat must be rejected",
  );
  assert.equal(
    SuggestBodySchema.safeParse(
      suggestBody({ lat: 50.45, lon: 30.52 }),
    ).success,
    true,
    "a complete coordinate pair remains valid",
  );
});

test("SuggestBodySchema rejects an inverted formality range", () => {
  const result = SuggestBodySchema.safeParse(
    suggestBody({ formalityMin: 5, formalityMax: 2 }),
  );

  assert.equal(result.success, false);
});

test("OutfitFeedbackSchema accepts a short metric reason but rejects noisy payloads", () => {
  assert.equal(
    OutfitFeedbackSchema.safeParse({
      outfitId: "outfit-1",
      liked: false,
      reason: "too_formal",
    }).success,
    true,
  );
  assert.equal(
    OutfitFeedbackSchema.safeParse({
      outfitId: "outfit-1",
      liked: false,
      reason: "x".repeat(120),
    }).success,
    false,
  );
});

test("mapIndexesToItems drops invalid indexes and deduplicates model output", () => {
  const pool = ["coat", "shirt", "boots"];

  assert.deepEqual(
    mapIndexesToItems([1, 1, -1, 99, 0, 0, 1.5], pool),
    ["shirt", "coat"],
  );
});

test("filterWardrobe excludes colors explicitly marked to avoid", () => {
  const avoided = wardrobeItem("avoided", {
    colorPrimary: "mustard",
    colorHex: "#D4A017",
  });
  const safe = wardrobeItem("safe", {
    colorPrimary: "navy",
    colorHex: "#000080",
  });

  const filtered = filterWardrobe([avoided, safe], {
    ...BASE_CONTEXT,
    avoidColors: [{ name: "Mustard", hex: "#D4A017" }],
  });

  assert.deepEqual(filtered.map(({ id }) => id), ["safe"]);
});

test("filterWardrobe excludes items whose condition is worn", () => {
  const worn = wardrobeItem("worn", { condition: "worn" });
  const good = wardrobeItem("good", { condition: "good" });

  const filtered = filterWardrobe([worn, good], BASE_CONTEXT);

  assert.deepEqual(filtered.map(({ id }) => id), ["good"]);
});

test("scoreItem recognizes a palette match by normalized hex value", () => {
  const palette = [{ name: "Deep blue", hex: "#000080" }];
  const matching = wardrobeItem("matching", {
    colorPrimary: "navy",
    colorHex: "#000080",
  });
  const unrelated = wardrobeItem("unrelated", {
    colorPrimary: "navy",
    colorHex: "#123456",
  });

  assert.ok(
    scoreItem(matching, { ...BASE_CONTEXT, colorPalette: palette }) >
      scoreItem(unrelated, { ...BASE_CONTEXT, colorPalette: palette }),
    "same palette hex should earn a relevance bonus even when names differ",
  );
});

test("rules-only fallback never returns an accessory-only outfit", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";

  try {
    const outfits = await generateOutfits(
      [
        wardrobeItem("scarf", {
          category: "accessories",
          subcategory: "scarf",
          fabric: "wool",
        }),
      ],
      BASE_CONTEXT,
      1,
    );

    assert.deepEqual(outfits, []);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("a cold-weather rules-only outfit always contains outerwear", async () => {
  const outfits = await generateOutfits(
    [
      wardrobeItem("shirt"),
      wardrobeItem("trousers", {
        category: "bottoms",
        subcategory: "trousers",
        colorPrimary: "grey",
        colorHex: "#808080",
      }),
    ],
    BASE_CONTEXT,
    1,
  );

  assert.ok(
    outfits.every((outfit) =>
      outfit.items.some((item) => item.category === "outerwear"),
    ),
    "do not emit a cold-weather outfit when no suitable outerwear exists",
  );
});
