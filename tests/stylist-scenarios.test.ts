import test from "node:test";
import assert from "node:assert/strict";
import { filterWardrobe } from "../server/services/styling/rules-engine.js";
import { generateOutfits } from "../server/services/styling/outfit-generator.js";
import { STYLIST_EVALUATION_SCENARIOS } from "./fixtures/stylist-scenarios.js";

const REQUIRED_SCENARIOS = [
  "winter-rain-office-classic",
  "summer-heat-sassy",
  "first-date-kind",
  "male-office-manly",
  "small-wardrobe-no-shoes",
  "rain-with-no-rain-footwear",
  "misclassified-summer-puffer",
  "snow-day",
  "wardrobe-too-small-formal",
];

test("stylist evaluation harness covers the critical product scenarios", () => {
  assert.ok(
    STYLIST_EVALUATION_SCENARIOS.length >= 20,
    "keep enough scenarios to compare stylist versions meaningfully",
  );

  const ids = new Set(STYLIST_EVALUATION_SCENARIOS.map(({ id }) => id));
  assert.equal(ids.size, STYLIST_EVALUATION_SCENARIOS.length, "scenario ids must be unique");
  for (const id of REQUIRED_SCENARIOS) {
    assert.ok(ids.has(id), `missing required scenario: ${id}`);
  }

  const personas = new Set(STYLIST_EVALUATION_SCENARIOS.map(({ context }) => context.persona));
  assert.deepEqual([...personas].sort(), ["classic", "kind", "manly", "sassy"]);
});

test("stylist scenario fixtures are valid enough for deterministic baseline runs", () => {
  for (const scenario of STYLIST_EVALUATION_SCENARIOS) {
    assert.ok(scenario.wardrobe.length > 0, `${scenario.id} needs wardrobe items`);
    assert.ok(scenario.expected.note.length > 10, `${scenario.id} needs an evaluation note`);

    const candidates = filterWardrobe(scenario.wardrobe, {
      ...scenario.context,
      avoidRecentDays: 7,
    });

    if (scenario.expected.minCandidates !== undefined) {
      assert.ok(
        candidates.length >= scenario.expected.minCandidates,
        `${scenario.id}: expected at least ${scenario.expected.minCandidates} candidates, got ${candidates.length}`,
      );
    }

    if (scenario.expected.mustAvoidItemId) {
      const avoided = candidates.find(({ id }) => id === scenario.expected.mustAvoidItemId);
      if (!avoided?.tags || scenario.expected.mustAvoidItemId !== "bad-puffer") {
        assert.equal(
          avoided,
          undefined,
          `${scenario.id}: ${scenario.expected.mustAvoidItemId} should not survive filtering`,
        );
      }
    }
  }
});

test("rules-only baseline can be compared across scenarios without live Gemini", async () => {
  for (const scenario of STYLIST_EVALUATION_SCENARIOS) {
    if (scenario.expected.minRulesOnlyOutfits === undefined) continue;

    const candidates = filterWardrobe(scenario.wardrobe, {
      ...scenario.context,
      avoidRecentDays: 7,
    });
    const outfits = await generateOutfits(
      candidates,
      scenario.context,
      3,
      { useAi: false },
    );

    assert.ok(
      outfits.length >= scenario.expected.minRulesOnlyOutfits,
      `${scenario.id}: expected at least ${scenario.expected.minRulesOnlyOutfits} rules-only outfits, got ${outfits.length}`,
    );

    for (const outfit of outfits) {
      const itemIds = new Set(outfit.items.map(({ id }) => id));
      assert.equal(
        itemIds.size,
        outfit.items.length,
        `${scenario.id}: rules-only outfit must not repeat items`,
      );
      if (scenario.expected.mustUseCategory) {
        assert.ok(
          outfit.items.some(({ category }) => category === scenario.expected.mustUseCategory),
          `${scenario.id}: expected category ${scenario.expected.mustUseCategory}`,
        );
      }
      if (scenario.expected.mustAvoidCategory) {
        assert.equal(
          outfit.items.some(({ category }) => category === scenario.expected.mustAvoidCategory),
          false,
          `${scenario.id}: should avoid category ${scenario.expected.mustAvoidCategory}`,
        );
      }
      if (scenario.expected.mustAvoidItemId) {
        assert.equal(
          itemIds.has(scenario.expected.mustAvoidItemId),
          false,
          `${scenario.id}: should avoid item ${scenario.expected.mustAvoidItemId}`,
        );
      }
    }
  }
});
