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

export const apiRouter = Router();

// Public routes — no auth required
apiRouter.use("/auth", authRouter);

apiRouter.get("/status", (_req, res) => {
  res.json({
    version: "0.1.0",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    cloudinaryConfigured:
      !!process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_KEY !== "MOCK_KEY",
    weatherConfigured:
      !!process.env.OPENWEATHER_API_KEY &&
      process.env.OPENWEATHER_API_KEY !== "MOCK_KEY",
    googleAuthConfigured: !!process.env.GOOGLE_CLIENT_ID,
  });
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
