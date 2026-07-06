import assert from "node:assert/strict";
import test from "node:test";

import { waitForGooglePicker } from "../src/services/google-picker.js";

test("Google Picker loader rejects when the SDK never becomes ready", async () => {
  await assert.rejects(
    waitForGooglePicker(() => undefined, 5),
    /timed out/i,
  );
});

test("Google Picker loader propagates a script loading failure", async () => {
  await assert.rejects(
    waitForGooglePicker((_ready, failed) => failed(), 100),
    /failed to load/i,
  );
});
