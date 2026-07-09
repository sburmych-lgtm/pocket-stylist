import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStylistV2Prompt,
  isStylistV2Enabled,
  parseStylistV2Outfits,
  STYLIST_V2_STYLE_DOCTRINE,
} from "../server/services/styling/outfit-generator.js";
import { wardrobeItem } from "./fixtures/stylist-scenarios.js";

const ctx = {
  mood: { energy: 62, boldness: 72 },
  weatherSeason: "winter",
  temp: 2,
  condition: "Snow",
  precipMm: 2,
  formalityRange: { min: 2, max: 4 },
  persona: "sassy",
  colorSeason: "Deep Winter",
  colorPalette: [{ name: "Deep Navy", hex: "#112244" }],
  avoidColors: [{ name: "Mustard", hex: "#D4A017" }],
  genderMode: "female",
} as const;

test("Stylist v2 feature flag is explicit and off by default", () => {
  assert.equal(isStylistV2Enabled({}), false);
  assert.equal(isStylistV2Enabled({ STYLIST_V2_ENABLED: "true" }), true);
  assert.equal(isStylistV2Enabled({ STYLIST_V2_ENABLED: "1" }), true);
  assert.equal(isStylistV2Enabled({ STYLIST_V2_ENABLED: "false" }), false);
});

test("Stylist v2 prompt includes doctrine, persona selection strategy and item review signals", () => {
  const prompt = buildStylistV2Prompt(
    [
      wardrobeItem("puffer", {
        category: "outerwear",
        subcategory: "winter puffer",
        season: "winter",
        tags: { needsReview: true, reviewReasons: ["outerwear_summer_conflict"] },
      }),
      wardrobeItem("boots", {
        category: "footwear",
        subcategory: "leather boots",
        fabric: "leather",
        season: "winter",
      }),
    ],
    ctx,
    3,
  );

  assert.ok(STYLIST_V2_STYLE_DOCTRINE.includes("senior fashion editor"));
  assert.match(prompt, /safe, balanced, bold/);
  assert.match(prompt, /sassy: choose a bolder accent/);
  assert.match(prompt, /Color season: Deep Winter/);
  assert.match(prompt, /Colors to AVOID: Mustard/);
  assert.match(prompt, /"needsReview": true/);
  assert.match(prompt, /"reviewReasons": \[/);
  assert.match(prompt, /Reply ONLY valid JSON/);
});

test("Stylist v2 parser preserves structured rationale and never invents items", () => {
  const pool = [
    wardrobeItem("top"),
    wardrobeItem("pants", { category: "pants" }),
    wardrobeItem("boots", { category: "footwear" }),
  ];

  const outfits = parseStylistV2Outfits(
    JSON.stringify([
      {
        variant: "balanced",
        name: "Сніжний баланс",
        itemIndexes: [0, 1, 2, 99, 2],
        stylingTip: "Це впевнено, але не занадто голосно.",
        whyItWorks: "Темний верх і чисті лінії тримають силует зібраним.",
        weatherFit: "Черевики закриті, а шари підходять для мокрого снігу.",
        risks: ["Якщо слизько, обери підошву з кращим протектором."],
        confidence: 0.82,
      },
    ]),
    pool,
    3,
  );

  assert.equal(outfits[0].variant, "balanced");
  assert.equal(outfits[0].stylistVersion, "v2");
  assert.deepEqual(outfits[0].items.map((item) => item.id), ["top", "pants", "boots"]);
  assert.match(outfits[0].whyItWorks ?? "", /силует/);
  assert.match(outfits[0].weatherFit ?? "", /Черевики/);
  assert.deepEqual(outfits[0].risks, ["Якщо слизько, обери підошву з кращим протектором."]);
});
