import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  createResetToken,
  verifyResetToken,
  fingerprintMatches,
} from "../server/services/password-reset.js";

const SECRET = "test-secret-abc";
const HASH = "scrypt$deadbeef$cafe";

test("createResetToken round-trips through verifyResetToken", () => {
  const token = createResetToken("user_1", HASH, SECRET);
  const claims = verifyResetToken(token, SECRET);
  assert.ok(claims);
  assert.equal(claims.userId, "user_1");
  assert.equal(typeof claims.fp, "string");
});

test("verifyResetToken rejects a token signed with a different secret", () => {
  const token = createResetToken("user_1", HASH, SECRET);
  assert.equal(verifyResetToken(token, "other-secret"), null);
});

test("verifyResetToken rejects a malformed token", () => {
  assert.equal(verifyResetToken("not.a.jwt", SECRET), null);
});

test("verifyResetToken rejects an expired token", () => {
  const expired = jwt.sign({ purpose: "pwreset", fp: "abc" }, SECRET, {
    subject: "user_1",
    expiresIn: -10,
  });
  assert.equal(verifyResetToken(expired, SECRET), null);
});

test("an ordinary auth token is NOT accepted as a reset token", () => {
  // Mirrors signToken() in auth.ts — no purpose, no subject.
  const authToken = jwt.sign({ userId: "user_1" }, SECRET, { expiresIn: "7d" });
  assert.equal(verifyResetToken(authToken, SECRET), null);
});

test("fingerprintMatches: true for the same hash, false once the hash changes", () => {
  const claims = verifyResetToken(createResetToken("user_1", HASH, SECRET), SECRET);
  assert.ok(claims);
  assert.equal(fingerprintMatches(HASH, claims.fp), true);
  // Simulate the password having already been changed since the link was minted.
  assert.equal(fingerprintMatches("scrypt$deadbeef$0000", claims.fp), false);
});
