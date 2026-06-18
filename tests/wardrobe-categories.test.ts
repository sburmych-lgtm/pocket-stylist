import test from "node:test";
import assert from "node:assert/strict";
import {
  WARDROBE_CATEGORIES,
  normalizeCategory,
  isWardrobeCategory,
} from "../src/shared/wardrobe-categories.js";

test("WARDROBE_CATEGORIES holds the 14 canonical sections", () => {
  assert.equal(WARDROBE_CATEGORIES.length, 14);
  for (const expected of [
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
  ]) {
    assert.ok(
      (WARDROBE_CATEGORIES as readonly string[]).includes(expected),
      `missing ${expected}`,
    );
  }
});

test("normalizeCategory folds legacy aliases to canonical names", () => {
  // The user-reported "winter coat at 26°C" bug had a sibling — rows tagged
  // "shoes" or "activewear" disappearing into the wrong UI bucket. Tighten
  // the alias map so legacy data still lands in the right section.
  assert.equal(normalizeCategory("shoes"), "footwear");
  assert.equal(normalizeCategory("Shoe"), "footwear");
  assert.equal(normalizeCategory("activewear"), "sportswear");
  assert.equal(normalizeCategory("sleepwear"), "pajamas");
  assert.equal(normalizeCategory("lingerie"), "underwear");
  assert.equal(normalizeCategory("jewelry"), "accessories");
});

test("normalizeCategory accepts already-canonical values verbatim", () => {
  for (const cat of WARDROBE_CATEGORIES) {
    assert.equal(normalizeCategory(cat), cat);
    assert.equal(normalizeCategory(cat.toUpperCase()), cat, `case-insensitive: ${cat}`);
  }
});

test("normalizeCategory falls back to 'tops' on null / unknown input", () => {
  assert.equal(normalizeCategory(null), "tops");
  assert.equal(normalizeCategory(undefined), "tops");
  assert.equal(normalizeCategory(""), "tops");
  assert.equal(normalizeCategory("vintage thrift unicorn"), "tops");
});

test("isWardrobeCategory is a precise type guard", () => {
  assert.equal(isWardrobeCategory("footwear"), true);
  assert.equal(isWardrobeCategory("shoes"), false); // legacy is normalized, not accepted
  assert.equal(isWardrobeCategory(123), false);
  assert.equal(isWardrobeCategory(null), false);
});
