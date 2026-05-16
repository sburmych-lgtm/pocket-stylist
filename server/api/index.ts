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
import { requireAuth } from "../middleware/auth.js";
import { getAppStatus } from "../services/app-status.js";

export const apiRouter = Router();

// Public routes — no auth required
apiRouter.use("/auth", authRouter);

apiRouter.get("/status", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(getAppStatus());
});

// Protected routes — require auth
apiRouter.use("/import", requireAuth, importRouter);
apiRouter.use("/styling", requireAuth, stylingRouter);
apiRouter.use("/scanner", requireAuth, scannerRouter);
apiRouter.use("/matching", requireAuth, matchingRouter);
apiRouter.use("/analytics", requireAuth, analyticsRouter);
apiRouter.use("/profile", requireAuth, profileRouter);
apiRouter.use("/lookbook", requireAuth, lookbookRouter);
apiRouter.use("/family", requireAuth, familyRouter);
