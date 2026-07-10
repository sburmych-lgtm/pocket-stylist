import { test } from "node:test";
import assert from "node:assert/strict";
import { createMinIntervalScheduler } from "../server/services/gemini.js";
import { rateLimitDelayMs } from "../server/services/gemini-client.js";

test("rateLimitDelayMs parses the structured retryDelay hint from a 429", () => {
  const err = new Error(
    'RESOURCE_EXHAUSTED ... "retryDelay":"13s" ... quota exceeded',
  );
  const ms = rateLimitDelayMs(err);
  assert.equal(ms, 13_000 + 750);
});

test("rateLimitDelayMs parses the human 'retry in Ns' phrase", () => {
  const err = new Error("You exceeded your quota. Please retry in 11.5s.");
  const ms = rateLimitDelayMs(err);
  assert.equal(ms, Math.ceil(11.5 * 1000) + 750);
});

test("rateLimitDelayMs falls back to a default wait for a hint-less quota error", () => {
  const err = new Error("429 Too Many Requests: quota exceeded");
  const ms = rateLimitDelayMs(err);
  assert.equal(ms, 12_000 + 750);
});

test("rateLimitDelayMs caps absurd retry delays", () => {
  const err = new Error('RESOURCE_EXHAUSTED "retryDelay":"600s"');
  const ms = rateLimitDelayMs(err);
  assert.equal(ms, 30_000); // capped at RATE_LIMIT_MAX_WAIT_MS default
});

test("rateLimitDelayMs returns null for non-rate-limit errors", () => {
  assert.equal(rateLimitDelayMs(new Error("400 invalid argument")), null);
  assert.equal(rateLimitDelayMs(new Error("timed out")), null);
  assert.equal(rateLimitDelayMs(null), null);
});

test("createMinIntervalScheduler serializes starts by the configured interval", async () => {
  let clock = 1_000;
  const sleeps: number[] = [];
  const scheduler = createMinIntervalScheduler(
    13_000,
    () => clock,
    async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
  );

  await Promise.all([scheduler(), scheduler(), scheduler()]);

  assert.deepEqual(sleeps, [13_000, 13_000]);
  assert.equal(clock, 27_000);
});
