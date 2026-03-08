import { Router } from "express";
import { importRouter } from "./import.js";
import { stylingRouter } from "./styling.js";
import { scannerRouter } from "./scanner.js";
import { matchingRouter } from "./matching.js";
import { analyticsRouter } from "./analytics.js";

export const apiRouter = Router();

apiRouter.use("/import", importRouter);
apiRouter.use("/styling", stylingRouter);
apiRouter.use("/scanner", scannerRouter);
apiRouter.use("/matching", matchingRouter);
apiRouter.use("/analytics", analyticsRouter);

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
