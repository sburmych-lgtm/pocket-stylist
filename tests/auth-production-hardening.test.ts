import test from "node:test";
import assert from "node:assert/strict";
import { isDemoMode } from "../server/middleware/auth.js";

test("missing Google OAuth configuration never enables implicit demo auth in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.NODE_ENV = "production";
  delete process.env.GOOGLE_CLIENT_ID;

  try {
    assert.equal(
      isDemoMode(),
      false,
      "production auth must fail closed instead of authenticating every request as demo",
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;

    if (previousGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = previousGoogleClientId;
    }
  }
});
