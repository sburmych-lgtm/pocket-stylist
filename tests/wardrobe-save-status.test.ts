import { test } from "node:test";
import assert from "node:assert/strict";
import { clothingAnalysisFromItem } from "../server/api/import.js";
import { reviewClothingAnalysis } from "../server/services/gemini.js";

// Regression: saving/editing a wardrobe item must NOT stamp it as
// "Не розпізнано" (analysisStatus: "failed" / reviewSeverity: "critical").
// The bug: clothingAnalysisFromItem spread FALLBACK_CLOTHING_ANALYSIS (which is
// analysisStatus:"failed", reviewSeverity:"critical") and the item override
// didn't cover those fields, so every save re-flagged the item as failed.

const cleanItem = {
  category: "tops",
  subcategory: "t-shirt",
  colorPrimary: "navy",
  colorHex: "#1c2b3a",
  pattern: "solid",
  fabric: "cotton",
  formalityLevel: 2,
  season: "all" as const,
  brand: null,
  confidence: 0.9,
  needsReview: false,
  reviewReasons: [],
};

test("a cleanly-recognised item stays recognised after being re-saved", () => {
  const analysis = clothingAnalysisFromItem(cleanItem);
  const reviewed = reviewClothingAnalysis(analysis, { trustManualReview: true }).item;

  assert.notEqual(reviewed.analysisStatus, "failed", "must not become 'failed'");
  assert.notEqual(reviewed.reviewSeverity, "critical", "must not become 'critical'");
  assert.equal(reviewed.needsReview, false, "a clean save must not need review");
});

test("clothingAnalysisFromItem does not inherit the fallback failed status", () => {
  const analysis = clothingAnalysisFromItem(cleanItem);
  assert.notEqual(analysis.analysisStatus, "failed");
  assert.notEqual(analysis.reviewSeverity, "critical");
});
