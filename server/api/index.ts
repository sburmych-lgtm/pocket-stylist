import { Router } from "express";
import { authRouter } from "./auth.js";
import { importRouter } from "./import.js";
import { stylingRouter } from "./styling.js";
import { scannerRouter } from "./scanner.js";
import { matchingRouter } from "./matching.js";
import { analyticsRouter } from "./analytics.js";
import { profileRouter } from "./profile.js";
import { lookbookRouter } from "./lookbook.js";
import { familyRouter } from "./family.js";
import { feedbackRouter } from "./feedback.js";
import { ttsRouter } from "./tts.js";
import { billingRouter } from "./billing.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePaidOrTrial } from "../middleware/require-access.js";
import { getAppStatus } from "../services/app-status.js";
import { isTtsElevenLabsEnabled } from "../services/tts.js";
import { STRIPE_ENABLED } from "../services/subscription.js";

export const apiRouter = Router();

// Public routes — no auth required
apiRouter.use("/auth", authRouter);

// Feedback — optional auth (anonymous senders allowed)
apiRouter.use("/feedback", feedbackRouter);

// Billing — auth handled per-route (webhook bypasses auth via Stripe signature).
apiRouter.use("/billing", billingRouter);

apiRouter.get("/status", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ...getAppStatus(),
    ttsConfigured: isTtsElevenLabsEnabled(),
    stripeConfigured: STRIPE_ENABLED,
  });
});

// Protected routes — require auth
apiRouter.use("/tts", requireAuth, requirePaidOrTrial, ttsRouter);
apiRouter.use("/import", requireAuth, importRouter);
apiRouter.use("/styling", requireAuth, requirePaidOrTrial, stylingRouter);
apiRouter.use("/scanner", requireAuth, requirePaidOrTrial, scannerRouter);
apiRouter.use("/matching", requireAuth, requirePaidOrTrial, matchingRouter);
apiRouter.use("/analytics", requireAuth, analyticsRouter);
apiRouter.use("/profile", requireAuth, profileRouter);
apiRouter.use("/lookbook", requireAuth, lookbookRouter);
apiRouter.use("/family", requireAuth, familyRouter);
