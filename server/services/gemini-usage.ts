import { prisma } from "./prisma.js";

/**
 * Daily Gemini quota tracking (free tier = 1,500 req/day for the whole
 * project). Every Gemini call — success OR failure — bumps a per-day,
 * per-requestType counter so /api/analytics and future admin tooling can
 * see how close we are to the budget.
 *
 * Recording is fire-and-forget: a DB hiccup must never break the AI
 * feature that triggered the call.
 */

/** UTC day bucket for the @db.Date column — time component zeroed. */
export function usageDateKey(now: Date = new Date()): Date {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export type GeminiRequestType =
  | "clothing-analysis"
  | "outfit-generation"
  | "outfit-generation-v2"
  | "color-season"
  | "reference-matching";

export function recordGeminiUsage(requestType: GeminiRequestType): void {
  const date = usageDateKey();
  prisma.geminiUsage
    .upsert({
      where: { date_requestType: { date, requestType } },
      update: { count: { increment: 1 } },
      create: { date, requestType, count: 1 },
    })
    .catch((err: unknown) => {
      console.warn(`[gemini-usage] failed to record ${requestType}:`, err);
    });
}

/** Total Gemini requests recorded for the given UTC day (all types). */
export async function getDailyGeminiUsage(now: Date = new Date()): Promise<number> {
  const rows = await prisma.geminiUsage.findMany({
    where: { date: usageDateKey(now) },
    select: { count: true },
  });
  return rows.reduce((sum, r) => sum + r.count, 0);
}
