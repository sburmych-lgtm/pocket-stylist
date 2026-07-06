import assert from "node:assert/strict";
import test from "node:test";
import { isDemoMode } from "../server/middleware/auth.ts";
import {
  createOAuthState,
  verifyOAuthState,
  escapeInlineJson,
} from "../server/services/oauth-state.ts";

test("production authentication never fails open into demo mode", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.NODE_ENV = "production";
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    assert.equal(isDemoMode(), false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousGoogleClientId;
  }
});

test("OAuth state is signed, expires, and is bound to the browser nonce", () => {
  const now = new Date("2026-07-05T00:00:00.000Z");
  const state = createOAuthState(
    {
      nonce: "browser-nonce-1234",
      flow: "login",
      returnTo: "/import",
      acceptedTerms: true,
    },
    "test-secret",
    now,
  );

  assert.deepEqual(verifyOAuthState(state, "browser-nonce-1234", "test-secret", now), {
    nonce: "browser-nonce-1234",
    flow: "login",
    returnTo: "/import",
    acceptedTerms: true,
  });
  assert.equal(verifyOAuthState(state, "other-browser", "test-secret", now), null);
  assert.equal(
    verifyOAuthState(
      state,
      "browser-nonce-1234",
      "test-secret",
      new Date(now.getTime() + 11 * 60_000),
    ),
    null,
  );
});

test("inline JSON escaping neutralizes script-closing payloads", () => {
  const escaped = escapeInlineJson("</script><script>alert(1)</script>");
  assert.equal(escaped.includes("</script>"), false);
  assert.equal(escaped.includes("\\u003c"), true);
});
