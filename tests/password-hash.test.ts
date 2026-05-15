import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Mirror the helpers from server/api/auth.ts so we can test the algorithm in isolation
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = await scryptAsync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

test("hashPassword produces verifiable hash", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("verifyPassword rejects wrong password", async () => {
  const hash = await hashPassword("real-password");
  assert.equal(await verifyPassword("wrong-password", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("verifyPassword rejects malformed stored values", async () => {
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  assert.equal(await verifyPassword("anything", "bcrypt$abcd$1234"), false);
});

test("hashPassword produces different hashes for same password (salted)", async () => {
  const a = await hashPassword("samepass");
  const b = await hashPassword("samepass");
  assert.notEqual(a, b, "salt must randomize hash");
  assert.equal(await verifyPassword("samepass", a), true);
  assert.equal(await verifyPassword("samepass", b), true);
});
