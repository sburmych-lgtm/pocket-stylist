import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { calculateEcoMetrics } from "../services/analytics/eco-calculator.js";
import {
  computeCostPerWear,
  findDeadZoneItems,
  computeGapAnalysis,
  computeGamification,
} from "../services/analytics/wardrobe-analytics.js";

export const analyticsRouter = Router();

// GET /api/analytics/dashboard — full analytics dashboard data
analyticsRouter.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const [wardrobe, outfits, outfitLogs] = await Promise.all([
      prisma.wardrobeItem.findMany({ where: { userId } }),
      prisma.outfit.findMany({ where: { userId } }),
      prisma.outfitLog.findMany({
        where: { userId },
        orderBy: { wornAt: "desc" },
      }),
    ]);

    // Cost per wear
    const costPerWear = computeCostPerWear(wardrobe);

    // Dead zone items
    const deadZone = findDeadZoneItems(wardrobe);

    // Gap analysis
    const gapAnalysis = computeGapAnalysis(wardrobe);

    // Eco metrics
    const eco = calculateEcoMetrics(wardrobe);

    // Gamification
    const totalWears = wardrobe.reduce((sum, w) => sum + w.timesWorn, 0);
    const firstItem = wardrobe.length > 0
      ? wardrobe.reduce((oldest, w) =>
          w.createdAt < oldest.createdAt ? w : oldest,
        )
      : null;
    const daysSinceFirst = firstItem
      ? Math.floor(
          (Date.now() - firstItem.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;

    const gamification = computeGamification(
      wardrobe.length,
      totalWears,
      outfits.length,
      deadZone.length,
      daysSinceFirst,
    );

    // Summary stats
    const summary = {
      totalItems: wardrobe.length,
      totalOutfits: outfits.length,
      totalWears,
      totalLogs: outfitLogs.length,
      avgWearCount:
        wardrobe.length > 0
          ? Math.round((totalWears / wardrobe.length) * 10) / 10
          : 0,
    };

    res.json({
      summary,
      costPerWear: costPerWear.slice(0, 20), // top 20 highest cost-per-wear
      deadZone,
      gapAnalysis,
      eco,
      gamification,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to compute analytics" });
  }
});
