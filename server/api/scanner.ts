import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { analyzeClothingImage } from "../services/gemini.js";

export const scannerRouter = Router();

const DEMO_USER_EMAIL = "demo@pocket-stylist.app";

async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Demo User" },
  });
}

// POST /api/scanner/analyze — Scan item in store, get BUY/SKIP verdict
scannerRouter.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { image, mimeType } = req.body as {
      image: string;
      mimeType: string;
    };

    if (!image || !mimeType) {
      res.status(400).json({ error: "image and mimeType are required" });
      return;
    }

    // Analyze the scanned item
    const tags = await analyzeClothingImage(image, mimeType);

    // Get user's wardrobe for comparison
    const user = await getDemoUser();
    const wardrobe = await prisma.wardrobeItem.findMany({
      where: { userId: user.id },
    });

    // Gap analysis: does user already have similar items?
    const sameCategory = wardrobe.filter((w) => w.category === tags.category);
    const sameColor = sameCategory.filter((w) => w.colorPrimary === tags.colorPrimary);
    const samePattern = sameCategory.filter((w) => w.pattern === tags.pattern);

    // Count how many new outfits this could create
    const complementary = wardrobe.filter((w) => {
      if (w.category === tags.category) return false;
      // Check if categories complement
      const combos: Record<string, string[]> = {
        tops: ["bottoms", "outerwear", "accessories"],
        bottoms: ["tops", "outerwear", "shoes"],
        dresses: ["outerwear", "shoes", "accessories"],
        outerwear: ["tops", "bottoms", "dresses"],
        shoes: ["tops", "bottoms", "dresses"],
      };
      return combos[tags.category]?.includes(w.category) ?? false;
    });

    // Calculate verdict
    const hasDuplicates = sameColor.length > 0;
    const hasManySimilar = sameCategory.length >= 5;
    const createsOutfits = complementary.length >= 2;
    const fillsGap = sameCategory.length === 0;

    let verdict: "BUY" | "SKIP" | "CONSIDER" = "CONSIDER";
    const reasons: string[] = [];

    if (fillsGap) {
      verdict = "BUY";
      reasons.push(`You don't have any ${tags.category} — this fills a gap!`);
    }
    if (createsOutfits) {
      reasons.push(`Can create ${Math.min(complementary.length, 10)}+ new outfits.`);
      if (verdict !== "BUY") verdict = "BUY";
    }
    if (hasDuplicates) {
      reasons.push(`You already have a ${tags.colorPrimary} ${tags.category}.`);
      verdict = "SKIP";
    }
    if (hasManySimilar) {
      reasons.push(`You already have ${sameCategory.length} items in ${tags.category}.`);
      if (!fillsGap) verdict = "SKIP";
    }

    // Cost-per-wear projection
    const avgWears = wardrobe.length > 0
      ? wardrobe.reduce((sum, w) => sum + w.timesWorn, 0) / wardrobe.length
      : 15;
    const projectedCostPerWear = tags.formalityLevel <= 2
      ? "Low (casual items get worn often)"
      : tags.formalityLevel >= 4
        ? "High (formal items get less use)"
        : "Medium";

    res.json({
      tags,
      verdict,
      reasons,
      stats: {
        sameCategoryCount: sameCategory.length,
        sameColorCount: sameColor.length,
        samePatternCount: samePattern.length,
        newOutfitPotential: Math.min(complementary.length, 10),
        projectedCostPerWear,
        avgWearsInWardrobe: Math.round(avgWears),
      },
    });
  } catch (err) {
    console.error("Scanner error:", err);
    res.status(500).json({ error: "Failed to analyze item" });
  }
});
