import assert from "node:assert/strict";
import test from "node:test";

import { API_NAVIGATION_DENYLIST } from "../src/shared/pwa-navigation.js";

test("PWA navigation fallback never intercepts API routes", () => {
  const isDenied = (path: string) =>
    API_NAVIGATION_DENYLIST.some((pattern) => pattern.test(path));

  assert.equal(isDenied("/api/auth/google/redirect"), true);
  assert.equal(isDenied("/api/status"), true);
  assert.equal(isDenied("/style"), false);
});
