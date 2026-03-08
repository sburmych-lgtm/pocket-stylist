import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { analyzeColorType } from "../services/color-analysis.js";
import type { ColorAnalysisResult } from "../services/color-analysis.js";

export const profileRouter = Router();

// GET /api/profile — Return user profile with color data
profileRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        genderMode: true,
        colorSeason: true,
        colorPalette: true,
        avoidColors: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/profile — Update user profile fields
profileRouter.patch("/", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { genderMode, name } = req.body as {
      genderMode?: string;
      name?: string;
    };

    const data: Record<string, unknown> = {};
    if (genderMode !== undefined) data.genderMode = genderMode;
    if (name !== undefined) data.name = name;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        genderMode: true,
        colorSeason: true,
        colorPalette: true,
        avoidColors: true,
      },
    });

    res.json(user);
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /api/profile/color-analysis — Analyze selfie for color type
profileRouter.post(
  "/color-analysis",
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { image } = req.body as { image?: string };

      if (!image) {
        res.status(400).json({ error: "image (base64) is required" });
        return;
      }

      const result: ColorAnalysisResult = await analyzeColorType(image);

      // Save to user profile — serialize through JSON to satisfy Prisma's InputJsonValue
      await prisma.user.update({
        where: { id: userId },
        data: {
          colorSeason: result.season,
          colorPalette: JSON.parse(JSON.stringify(result.palette)),
          avoidColors: JSON.parse(JSON.stringify(result.avoid)),
        },
      });

      res.json(result);
    } catch (err) {
      console.error("Color analysis error:", err);
      const message =
        err instanceof Error ? err.message : "Color analysis failed";
      res.status(500).json({ error: message });
    }
  },
);
