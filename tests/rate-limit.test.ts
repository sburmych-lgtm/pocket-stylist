import test from "node:test";
import assert from "node:assert/strict";
import { rateLimitPerUser, _ratelimitReset } from "../server/middleware/rate-limit.js";

interface MockHeaders {
  [k: string]: string;
}

function makeReqRes(userId: string) {
  let status = 200;
  let body: unknown = null;
  const headers: MockHeaders = {};
  const req = { userId } as unknown as Parameters<
    ReturnType<typeof rateLimitPerUser>
  >[0];
  const res = {
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    status(code: number) {
      status = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
  } as unknown as Parameters<ReturnType<typeof rateLimitPerUser>>[1];
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  return {
    req,
    res,
    next,
    state: () => ({ status, body, headers, nextCalled }),
  };
}

test("rateLimitPerUser allows up to the configured limit", async () => {
  _ratelimitReset();
  const limiter = rateLimitPerUser({ limit: 3, windowMs: 1000, tag: "t" });
  for (let i = 0; i < 3; i++) {
    const { req, res, next, state } = makeReqRes("u1");
    limiter(req, res, next);
    const s = state();
    assert.equal(s.nextCalled, true, `call ${i + 1} should pass`);
    assert.equal(s.headers["X-RateLimit-Limit"], "3");
    assert.equal(s.headers["X-RateLimit-Remaining"], String(2 - i));
  }
});

test("rateLimitPerUser rejects the 4th call with 429 + Retry-After", () => {
  _ratelimitReset();
  const limiter = rateLimitPerUser({ limit: 3, windowMs: 1000, tag: "t" });
  for (let i = 0; i < 3; i++) {
    const { req, res, next } = makeReqRes("u1");
    limiter(req, res, next);
  }
  const { req, res, next, state } = makeReqRes("u1");
  limiter(req, res, next);
  const s = state();
  assert.equal(s.status, 429);
  assert.equal(s.nextCalled, false);
  assert.ok(s.headers["Retry-After"], "must set Retry-After header");
  assert.equal((s.body as { error: string }).error, "rate_limit_exceeded");
});

test("rateLimitPerUser isolates users by userId", () => {
  _ratelimitReset();
  const limiter = rateLimitPerUser({ limit: 1, windowMs: 1000, tag: "t" });
  const a = makeReqRes("user-a");
  const b = makeReqRes("user-b");
  limiter(a.req, a.res, a.next);
  limiter(b.req, b.res, b.next);
  assert.equal(a.state().nextCalled, true);
  assert.equal(b.state().nextCalled, true);
  // Each used 1/1 — both should be blocked next.
  const a2 = makeReqRes("user-a");
  limiter(a2.req, a2.res, a2.next);
  assert.equal(a2.state().status, 429);
});

test("rateLimitPerUser releases capacity after window expires", async () => {
  _ratelimitReset();
  const limiter = rateLimitPerUser({ limit: 1, windowMs: 80, tag: "t" });
  const first = makeReqRes("u-window");
  limiter(first.req, first.res, first.next);
  assert.equal(first.state().nextCalled, true);

  const second = makeReqRes("u-window");
  limiter(second.req, second.res, second.next);
  assert.equal(second.state().status, 429);

  await new Promise((r) => setTimeout(r, 100));

  const third = makeReqRes("u-window");
  limiter(third.req, third.res, third.next);
  assert.equal(third.state().nextCalled, true, "should pass after window expiry");
});
