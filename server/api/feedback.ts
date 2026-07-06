import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { optionalAuth } from "../middleware/auth.js";
import { withTimeout } from "../services/gemini-utils.js";
import { isDemoUser } from "../services/demo-store.js";
import { rateLimitByIp } from "../middleware/rate-limit.js";

export const feedbackRouter = Router();
const feedbackLimiter = rateLimitByIp({
  tag: "feedback",
  limit: 10,
  windowMs: 60 * 60_000,
});

const FeedbackSchema = z.object({
  message: z.string().min(3).max(2000),
  email: z.string().email().max(254).optional().nullable(),
  source: z.string().max(60).optional().nullable(),
});

// POST /api/feedback — anonymous OR authed user feedback. Stores into Feedback
// table. Demo users still go through (anonymously) so the demo flow can prove
// the end-to-end works without polluting the real users table.
feedbackRouter.post("/", feedbackLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = FeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { message, email, source } = parsed.data;

    const userId = req.userId && !isDemoUser(req.userId) ? req.userId : null;
    const userAgent = (req.headers["user-agent"] ?? "").toString().slice(0, 500);

    await withTimeout(
      prisma.feedback.create({
        data: {
          userId,
          email: email ?? null,
          message,
          source: source ?? null,
          userAgent,
        },
      }),
      5_000,
      "Feedback insert timed out",
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("[feedback] save error:", err);
    res.status(500).json({ error: "feedback_failed" });
  }
});
