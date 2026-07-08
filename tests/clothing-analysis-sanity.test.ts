import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_CLOTHING_ANALYSIS,
  reviewClothingAnalysis,
} from "../server/services/gemini.js";

function analysis(overrides: Partial<typeof FALLBACK_CLOTHING_ANALYSIS>) {
  return {
    ...FALLBACK_CLOTHING_ANALYSIS,
    category: "tops",
    subcategory: "t-shirt",
    fabric: "cotton",
    season: "summer",
    confidence: 0.92,
    needsReview: false,
    reviewReasons: [],
    ...overrides,
  };
}

test("clothing analysis marks outerwear tagged as summer for review and moves it out of summer", () => {
  const result = reviewClothingAnalysis(
    analysis({
      category: "outerwear",
      subcategory: "puffer winter jacket",
      fabric: "polyester",
      season: "summer",
    }),
  );

  assert.equal(result.needsReview, true);
  assert.equal(result.item.season, "winter");
  assert.ok(result.reviewReasons.includes("outerwear_summer_conflict"));
  assert.ok(result.item.confidence < 0.7);
});

test("clothing analysis does not trust heavy cold fabrics marked as summer", () => {
  const result = reviewClothingAnalysis(
    analysis({
      category: "tops",
      subcategory: "cashmere sweater",
      fabric: "cashmere",
      season: "summer",
    }),
  );

  assert.equal(result.needsReview, true);
  assert.equal(result.item.season, "winter");
  assert.ok(result.reviewReasons.includes("cold_fabric_summer_conflict"));
});

test("clothing analysis catches open footwear marked as winter", () => {
  const result = reviewClothingAnalysis(
    analysis({
      category: "footwear",
      subcategory: "leather sandals",
      fabric: "leather",
      season: "winter",
    }),
  );

  assert.equal(result.needsReview, true);
  assert.equal(result.item.season, "summer");
  assert.ok(result.reviewReasons.includes("open_footwear_winter_conflict"));
});

test("clothing analysis flags low-confidence results without changing sane fields", () => {
  const result = reviewClothingAnalysis(
    analysis({
      category: "tops",
      subcategory: "cotton shirt",
      fabric: "cotton",
      season: "all",
      confidence: 0.52,
    }),
  );

  assert.equal(result.needsReview, true);
  assert.equal(result.item.season, "all");
  assert.ok(result.reviewReasons.includes("low_confidence"));
});

test("clothing analysis leaves coherent high-confidence tags alone", () => {
  const result = reviewClothingAnalysis(
    analysis({
      category: "tops",
      subcategory: "linen shirt",
      fabric: "linen",
      season: "summer",
      confidence: 0.91,
    }),
  );

  assert.equal(result.needsReview, false);
  assert.equal(result.item.season, "summer");
  assert.equal(result.reviewReasons.length, 0);
  assert.equal(result.item.confidence, 0.91);
});
