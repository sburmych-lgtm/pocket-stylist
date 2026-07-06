import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { analyzeClothingImage, FALLBACK_CLOTHING_ANALYSIS } from "../services/gemini.js";
import { getDemoWardrobe, isDemoUser } from "../services/demo-store.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { ImageAnalyzeBodySchema } from "../services/request-schemas.js";
import { normalizeCategory } from "../../src/shared/wardrobe-categories.js";

const geminiLimiter = rateLimitPerUser({ tag: "gemini" });

export const scannerRouter = Router();
const ColorEntriesSchema = z.array(
  z.object({
    name: z.string(),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
);

/**
 * Which wardrobe categories complement a scanned item for the "new outfit
 * potential" half of the verdict. Keys and values use the CANONICAL
 * taxonomy (footwear/jeans/pants/skirts/... — see wardrobe-categories.ts).
 * Exported for tests.
 */
export const OUTFIT_COMBOS: Record<string, readonly string[]> = {
  tops: ["bottoms", "jeans", "pants", "skirts", "outerwear", "footwear", "accessories"],
  bottoms: ["tops", "outerwear", "footwear"],
  jeans: ["tops", "outerwear", "footwear"],
  pants: ["tops", "outerwear", "footwear"],
  skirts: ["tops", "outerwear", "footwear"],
  dresses: ["outerwear", "footwear", "accessories"],
  outerwear: ["tops", "bottoms", "jeans", "pants", "skirts", "dresses"],
  footwear: ["tops", "bottoms", "jeans", "pants", "skirts", "dresses"],
  suits: ["footwear", "accessories", "tops"],
  sportswear: ["sportswear", "footwear", "outerwear"],
  accessories: ["tops", "dresses", "outerwear"],
  swimwear: ["accessories", "footwear"],
  pajamas: [],
  underwear: [],
};

// POST /api/scanner/analyze — Scan item in store, get BUY/SKIP verdict
scannerRouter.post("/analyze", geminiLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = ImageAnalyzeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { image, mimeType } = parsed.data;

    // Analyze the scanned item; keep scanner usable if AI is temporarily
    // unavailable — but tell the client the verdict is unreliable instead of
    // silently pretending the garment is a black cotton top.
    let analysisReliable = true;
    const tags = await analyzeClothingImage(image, mimeType).catch((err) => {
      console.error("Scanner Gemini analysis failed:", err);
      analysisReliable = false;
      return FALLBACK_CLOTHING_ANALYSIS;
    });
    const scannedCategory = normalizeCategory(tags.category);

    // Get user's wardrobe for comparison
    const userId = req.userId!;
    const [rawWardrobe, profile] = isDemoUser(userId)
      ? [getDemoWardrobe(userId), null] as const
      : await Promise.all([
          prisma.wardrobeItem.findMany({ where: { userId } }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { colorSeason: true, colorPalette: true, avoidColors: true },
          }),
        ]);
    const wardrobe = rawWardrobe.map((w) => ({
      ...w,
      category: normalizeCategory(w.category),
    }));

    // Gap analysis: does user already have similar items?
    const sameCategory = wardrobe.filter((w) => w.category === scannedCategory);
    const sameColor = sameCategory.filter((w) => w.colorPrimary === tags.colorPrimary);
    const samePattern = sameCategory.filter((w) => w.pattern === tags.pattern);

    // Count how many new outfits this could create
    const complementary = wardrobe.filter((w) => {
      if (w.category === scannedCategory) return false;
      return OUTFIT_COMBOS[scannedCategory]?.includes(w.category) ?? false;
    });

    // Calculate verdict
    const hasDuplicates = sameColor.length > 0;
    const hasManySimilar = sameCategory.length >= 5;
    const createsOutfits = complementary.length >= 2;
    const fillsGap = sameCategory.length === 0;
    const palette = ColorEntriesSchema.safeParse(profile?.colorPalette).data ?? [];
    const avoid = ColorEntriesSchema.safeParse(profile?.avoidColors).data ?? [];
    const normalizedColor = tags.colorPrimary.toLowerCase();
    const paletteMatch =
      palette.length === 0 ||
      palette.some(
        (entry) =>
          entry.hex.toLowerCase() === tags.colorHex.toLowerCase() ||
          entry.name.toLowerCase().includes(normalizedColor),
      );
    const avoidMatch = avoid.some(
      (entry) =>
        entry.hex.toLowerCase() === tags.colorHex.toLowerCase() ||
        entry.name.toLowerCase().includes(normalizedColor),
    );

    let verdict: "BUY" | "SKIP" | "CONSIDER" = "CONSIDER";
    const reasons: string[] = [];

    if (fillsGap) {
      verdict = "BUY";
      reasons.push(`You don't have any ${scannedCategory} — this fills a gap!`);
    }
    if (createsOutfits) {
      reasons.push(`Can create ${Math.min(complementary.length, 10)}+ new outfits.`);
      if (verdict !== "BUY") verdict = "BUY";
    }
    if (hasDuplicates) {
      reasons.push(`You already have a ${tags.colorPrimary} ${scannedCategory}.`);
      verdict = "SKIP";
    }
    if (hasManySimilar) {
      reasons.push(`You already have ${sameCategory.length} items in ${scannedCategory}.`);
      if (!fillsGap) verdict = "SKIP";
    }
    if (avoidMatch) {
      verdict = "SKIP";
      reasons.unshift("This color is on your personal avoid list.");
    } else if (!paletteMatch && verdict === "BUY") {
      verdict = "CONSIDER";
      reasons.unshift("The item is useful, but its color is outside your saved palette.");
    }

    // AI unavailable → the tags are placeholder values, so a BUY/SKIP verdict
    // would be based on fiction. Downgrade to CONSIDER and say why.
    if (!analysisReliable) {
      verdict = "CONSIDER";
      reasons.unshift(
        "AI analysis is temporarily unavailable — the verdict below is a rough estimate. Try again in a minute.",
      );
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
      tags: { ...tags, category: scannedCategory },
      verdict,
      reasons,
      analysisReliable,
      colorSeason: profile?.colorSeason ?? null,
      paletteMatch,
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
