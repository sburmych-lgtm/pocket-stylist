import test from "node:test";
import assert from "node:assert/strict";
import {
  STYLIST_PERSONAS,
  PERSONA_PROMPTS,
  isValidPersona,
  normalizePersona,
  applyPersona,
  type StylistPersona,
} from "../server/services/styling/personas.js";

const SAMPLE_BASE_PROMPT = `You are a fashion stylist. Create 3 outfits.

Schema:
[{ "name": "x", "itemIndexes": [0], "stylingTip": "y", "confidence": 0.5 }]

Reply ONLY valid JSON. No markdown, no explanation.`;

test("STYLIST_PERSONAS holds the 4 canonical voices", () => {
  assert.equal(STYLIST_PERSONAS.length, 4);
  for (const expected of ["classic", "sassy", "manly", "kind"]) {
    assert.ok(
      (STYLIST_PERSONAS as readonly string[]).includes(expected),
      `missing persona ${expected}`,
    );
  }
});

test("PERSONA_PROMPTS has a complete entry for every persona", () => {
  for (const persona of STYLIST_PERSONAS) {
    const entry = PERSONA_PROMPTS[persona];
    assert.ok(entry, `missing prompt entry for ${persona}`);
    assert.ok(entry.systemPrompt.length > 0, `${persona} systemPrompt empty`);
    assert.ok(entry.styleNote.length > 0, `${persona} styleNote empty`);
    assert.ok(entry.sampleQuote.length > 0, `${persona} sampleQuote empty`);
  }
});

test("isValidPersona accepts canonical values, rejects junk", () => {
  for (const persona of STYLIST_PERSONAS) {
    assert.equal(isValidPersona(persona), true);
  }
  assert.equal(isValidPersona("Classic"), false); // case sensitive — caller normalizes
  assert.equal(isValidPersona(""), false);
  assert.equal(isValidPersona(null), false);
  assert.equal(isValidPersona(undefined), false);
  assert.equal(isValidPersona(42), false);
  assert.equal(isValidPersona({ persona: "sassy" }), false);
  assert.equal(isValidPersona("savage"), false);
});

test("normalizePersona falls back to 'classic' for invalid input", () => {
  assert.equal(normalizePersona("invalid"), "classic");
  assert.equal(normalizePersona(null), "classic");
  assert.equal(normalizePersona(undefined), "classic");
  assert.equal(normalizePersona(""), "classic");
  assert.equal(normalizePersona("   "), "classic");
  assert.equal(normalizePersona("savage"), "classic");
});

test("normalizePersona accepts canonical values and is case-insensitive", () => {
  for (const persona of STYLIST_PERSONAS) {
    assert.equal(normalizePersona(persona), persona);
    assert.equal(normalizePersona(persona.toUpperCase()), persona, `case-insensitive: ${persona}`);
    assert.equal(normalizePersona(`  ${persona}  `), persona, `trims whitespace: ${persona}`);
  }
});

test("applyPersona prepends each persona's distinct voice signature", () => {
  // Each persona's system prompt should land in the final string so Gemini
  // sees the right tone instructions.
  const checks: Array<[StylistPersona, string]> = [
    ["classic", "polished, neutral professional"],
    ["sassy", "Anthony Marangello"],
    ["manly", "real man"],
    ["kind", "warm, motherly"],
  ];
  for (const [persona, signature] of checks) {
    const wrapped = applyPersona(SAMPLE_BASE_PROMPT, persona);
    assert.ok(
      wrapped.includes(signature),
      `applyPersona('${persona}') should contain "${signature}"`,
    );
  }
});

test("applyPersona NEVER drops the strict JSON-only instruction from the base prompt", () => {
  // This is the load-bearing invariant — a playful persona must not make
  // Gemini answer in prose. The "Reply ONLY valid JSON" line is the contract.
  for (const persona of STYLIST_PERSONAS) {
    const wrapped = applyPersona(SAMPLE_BASE_PROMPT, persona);
    assert.ok(
      wrapped.includes("Reply ONLY valid JSON. No markdown, no explanation."),
      `${persona}: base JSON instruction missing`,
    );
    // Persona prompts ALSO carry their own JSON guard rail.
    assert.ok(
      /JSON/i.test(wrapped),
      `${persona}: persona text should reinforce JSON contract`,
    );
  }
});

test("applyPersona keeps the base prompt at the END so the JSON instruction is last", () => {
  // Critical: Gemini follows the latest instruction most strongly, so the
  // base prompt (which ends in "Reply ONLY valid JSON") must come AFTER
  // the persona voice instructions — not before.
  for (const persona of STYLIST_PERSONAS) {
    const wrapped = applyPersona(SAMPLE_BASE_PROMPT, persona);
    const basePromptStart = wrapped.indexOf("You are a fashion stylist");
    const personaPromptStart = wrapped.indexOf(PERSONA_PROMPTS[persona].systemPrompt.slice(0, 20));
    assert.ok(personaPromptStart < basePromptStart, `${persona}: persona must come before base`);
    assert.ok(
      wrapped.trimEnd().endsWith("Reply ONLY valid JSON. No markdown, no explanation."),
      `${persona}: JSON instruction must be the final line`,
    );
  }
});

test("applyPersona produces distinct outputs for each persona", () => {
  const outputs = STYLIST_PERSONAS.map((p) => applyPersona(SAMPLE_BASE_PROMPT, p));
  const unique = new Set(outputs);
  assert.equal(
    unique.size,
    STYLIST_PERSONAS.length,
    "every persona should produce a unique wrapped prompt",
  );
});
