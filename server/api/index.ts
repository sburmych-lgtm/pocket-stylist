import { Router } from "express";

export const apiRouter = Router();

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
