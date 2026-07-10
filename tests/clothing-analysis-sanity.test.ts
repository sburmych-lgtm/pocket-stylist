import test from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_CLOTHING_ANALYSIS,
  normalizeClothingAnalysisPayload,
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
      confidence: 0.42,
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

test("clothing analysis does not coerce nuanced colors to black", () => {
  const result = normalizeClothingAnalysisPayload({
    category: "shirt",
    subcategory: "button-down shirt",
    colorPrimary: "coffee with milk",
    colorHex: "#B49A7E",
    pattern: "plain",
    fabric: "cotton",
    formalityLevel: 3,
    season: "all",
    brand: null,
    confidence: 0.82,
  });

  assert.equal(result.category, "tops");
  assert.equal(result.colorPrimary, "coffee");
  assert.notEqual(result.colorPrimary, "black");
  assert.equal(result.pattern, "solid");
  assert.equal(result.rawColorPrimary, "coffee with milk");
});

test("clothing analysis routes blazers and suit jackets away from generic tops", () => {
  const result = normalizeClothingAnalysisPayload({
    category: "suit jacket",
    subcategory: "checked blazer",
    colorPrimary: "charcoal",
    colorHex: "#333333",
    pattern: "check",
    fabric: "wool",
    formalityLevel: 4,
    season: "fall",
    confidence: 0.86,
  });

  assert.equal(result.category, "suits");
  assert.equal(result.pattern, "checkered");
  assert.equal(result.colorPrimary, "charcoal");
});

test("analysis failure fallback is honest unknown data, not fake black cotton tops", () => {
  assert.equal(FALLBACK_CLOTHING_ANALYSIS.analysisStatus, "failed");
  assert.equal(FALLBACK_CLOTHING_ANALYSIS.colorPrimary, "unknown");
  assert.equal(FALLBACK_CLOTHING_ANALYSIS.fabric, "unknown");
  assert.notEqual(FALLBACK_CLOTHING_ANALYSIS.colorPrimary, "black");
});
