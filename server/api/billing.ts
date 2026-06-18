import { Router, raw } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { isDemoUser } from "../services/demo-store.js";
import {
  STRIPE_ENABLED,
  createCheckoutSession,
  createPortalSession,
  getEffectiveSubscription,
  getStripeClient,
  handleStripeWebhook,
} from "../services/subscription.js";

export const billingRouter = Router();

function getAppUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN)
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `${req.protocol}://${req.get("host")}`;
}

// GET /api/billing/me — Current subscription state for the signed-in user.
// Always returns 200 so the FE banner/paywall can render conditionally.
billingRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const sub = await getEffectiveSubscription(req.userId!);
    res.set("Cache-Control", "no-store");
    res.json(sub);
  } catch (err) {
    console.error("billing.me error:", err);
    res.status(500).json({ error: "billing_me_failed" });
  }
});

// POST /api/billing/checkout — Create a Stripe Checkout session for the Pro plan.
billingRouter.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!STRIPE_ENABLED) {
      res.status(503).json({ error: "stripe_not_configured" });
      return;
    }
    if (isDemoUser(req.userId)) {
      res.status(403).json({ error: "demo_users_cannot_subscribe" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { email: true },
    });
    if (!user) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const appUrl = getAppUrl(req);
    const session = await createCheckoutSession({
      userId: req.userId!,
      userEmail: user.email,
      successUrl: `${appUrl}/?billing=success`,
      cancelUrl: `${appUrl}/?billing=cancel`,
    });

    if (!session) {
      res.status(503).json({ error: "stripe_price_not_configured" });
      return;
    }

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("billing.checkout error:", err);
    res.status(500).json({ error: "checkout_failed" });
  }
});

// POST /api/billing/portal — Open the Stripe Customer Portal so the user can
// manage their card / cancel / view invoices.
billingRouter.post("/portal", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!STRIPE_ENABLED) {
      res.status(503).json({ error: "stripe_not_configured" });
      return;
    }
    const appUrl = getAppUrl(req);
    const session = await createPortalSession(req.userId!, `${appUrl}/profile`);
    if (!session) {
      res.status(404).json({ error: "no_active_subscription" });
      return;
    }
    res.json({ url: session.url });
  } catch (err) {
    console.error("billing.portal error:", err);
    res.status(500).json({ error: "portal_failed" });
  }
});

// POST /api/billing/webhook — Stripe webhook receiver.
//
// IMPORTANT: this route MUST use express.raw() (not the JSON body parser) so
// the signature verification has the exact byte stream Stripe signed. It is
// mounted with the raw middleware locally below; the server-level express.json
// is bypassed by virtue of express running matched middleware first.
billingRouter.post(
  "/webhook",
  raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    try {
      const stripe = getStripeClient();
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!stripe || !secret) {
        res.status(503).json({ error: "stripe_not_configured" });
        return;
      }

      const sig = req.headers["stripe-signature"];
      if (typeof sig !== "string") {
        res.status(400).json({ error: "missing_signature" });
        return;
      }

      let event;
      try {
        // `req.body` is a Buffer here thanks to express.raw above.
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig,
          secret,
        );
      } catch (err) {
        console.error("Stripe webhook signature verification failed:", err);
        res.status(400).json({ error: "invalid_signature" });
        return;
      }

      await handleStripeWebhook(event);
      res.json({ received: true });
    } catch (err) {
      console.error("billing.webhook error:", err);
      res.status(500).json({ error: "webhook_failed" });
    }
  },
);
