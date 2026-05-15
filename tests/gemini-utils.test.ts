import test from "node:test";
import assert from "node:assert/strict";
import { parseGeminiJson, withTimeout } from "../server/services/gemini-utils.js";

test("parseGeminiJson accepts plain and fenced JSON", () => {
  assert.deepEqual(parseGeminiJson('{"ok":true}'), { ok: true });
  assert.deepEqual(parseGeminiJson('```json\n{"ok":true}\n```'), { ok: true });
});

test("withTimeout rejects slow promises", async () => {
  await assert.rejects(
    () => withTimeout(new Promise((resolve) => setTimeout(resolve, 50)), 1, "too slow"),
    /too slow/,
  );
});
