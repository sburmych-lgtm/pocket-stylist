import type { Request, Response, NextFunction } from "express";
import { getEffectiveSubscription, STRIPE_ENABLED } from "../services/subscription.js";

/**
 * Gate AI-heavy endpoints behind an active trial or paid subscription.
 *
 * Without STRIPE_SECRET_KEY in env, this middleware short-circuits to allow
 * everything — so the app continues to work end-to-end without any payment
 * configuration. When Stripe IS configured, expired trials (and unpaid
 * states) receive HTTP 402 Payment Required with a structured body the
 * frontend interceptor uses to open the paywall.
 */
export async function requirePaidOrTrial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Cheap exit: with Stripe disabled there's nothing to gate. Saves us a
  // DB roundtrip on every styling/matching/scanner request.
  if (!STRIPE_ENABLED) {
    next();
    return;
  }

  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const sub = await getEffectiveSubscription(userId);
    if (sub.hasAccess) {
      next();
      return;
    }
    res.status(402).json({
      error: "subscription_required",
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      daysLeft: sub.daysLeft,
    });
  } catch (err) {
    // Never let a billing lookup block legitimate users: degrade open.
    console.error("requirePaidOrTrial error:", err);
    next();
  }
}
