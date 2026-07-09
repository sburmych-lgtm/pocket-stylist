import test from "node:test";
import assert from "node:assert/strict";
import {
  geminiImagePart,
  geminiJsonConfig,
  geminiTextAndImageContent,
  geminiTextPart,
  geminiUserContent,
} from "../server/services/gemini-client.js";

test("gemini client helpers build multimodal user content for image prompts", () => {
  assert.deepEqual(geminiTextPart("Analyze"), { text: "Analyze" });
  assert.deepEqual(geminiImagePart("abc123", "image/png"), {
    inlineData: {
      mimeType: "image/png",
      data: "abc123",
    },
  });
  assert.deepEqual(geminiTextAndImageContent("Analyze", "abc123", "image/png"), {
    role: "user",
    parts: [
      { text: "Analyze" },
      { inlineData: { mimeType: "image/png", data: "abc123" } },
    ],
  });
});

test("gemini user content keeps part order stable", () => {
  assert.deepEqual(geminiUserContent([{ text: "one" }, { text: "two" }]), {
    role: "user",
    parts: [{ text: "one" }, { text: "two" }],
  });
});

test("gemini JSON config opts into structured JSON responses without hiding overrides", () => {
  assert.deepEqual(geminiJsonConfig({ temperature: 0.2 }), {
    responseMimeType: "application/json",
    temperature: 0.2,
  });
  assert.deepEqual(geminiJsonConfig({ responseMimeType: "text/plain" }), {
    responseMimeType: "text/plain",
  });
});
