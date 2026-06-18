import type { Request, Response, NextFunction } from "express";

/**
 * Per-user sliding-window rate limiter for Gemini-backed endpoints.
 *
 * Rationale (LLM Council audit):
 * Gemini 2.5 Flash free tier is capped at 1500 requests / day for the
 * entire project. A single power user can drain that budget in an
 * afternoon by spamming photo uploads, leaving every other paying user
 * with FALLBACK_CLOTHING_ANALYSIS results. This middleware caps each
 * user (by userId) at LIMIT requests / WINDOW_MS rolling.
 *
 * Storage is an in-memory Map. For multi-instance deploys swap for
 * Redis: the contract is `bucket = string -> Date[]` with the same
 * sliding-window math. Single-process Railway dyno makes the in-memory
 * version safe today.
 *
 * Demo users share a single bucket so they can't probe the limiter as
 * an oracle.
 */
const buckets = new Map<string, number[]>();

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

interface RateLimitOptions {
  /** Max successful requests per window per user. Default 60. */
  limit?: number;
  /** Sliding window length in ms. Default 24 h. */
  windowMs?: number;
  /** Tag for logs / 429 response, e.g. "gemini". */
  tag?: string;
}

function pruneBucket(timestamps: number[], cutoff: number): number[] {
  // O(n) prune, but n is bounded by `limit` so this is fine.
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  return i === 0 ? timestamps : timestamps.slice(i);
}

export function rateLimitPerUser(options: RateLimitOptions = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const tag = options.tag ?? "ai";

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${tag}:${req.userId ?? "anon"}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    const existing = buckets.get(key) ?? [];
    const pruned = pruneBucket(existing, cutoff);

    if (pruned.length >= limit) {
      const retryAfterMs = Math.max(0, windowMs - (now - pruned[0]));
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader(
        "X-RateLimit-Reset",
        String(Math.floor((now + retryAfterMs) / 1000)),
      );
      res.status(429).json({
        error: "rate_limit_exceeded",
        retryAfter: retryAfterSec,
        scope: tag,
        limit,
      });
      // Keep the pruned bucket so memory stays bounded.
      buckets.set(key, pruned);
      return;
    }

    pruned.push(now);
    buckets.set(key, pruned);

    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(limit - pruned.length));
    next();
  };
}

/**
 * Expose internal counters for tests + a future /api/admin endpoint.
 */
export function _ratelimitDebug() {
  return {
    bucketCount: buckets.size,
    totals: [...buckets.entries()].map(([k, v]) => ({ key: k, count: v.length })),
  };
}

/** Test-only helper to reset the in-memory bucket. */
export function _ratelimitReset() {
  buckets.clear();
}
