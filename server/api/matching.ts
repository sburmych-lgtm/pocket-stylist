import { Router } from "express";
import type { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { isConfiguredSecret } from "../services/app-status.js";
import { getDemoWardrobe, isDemoUser } from "../services/demo-store.js";
import { parseGeminiJson, withTimeout } from "../services/gemini-utils.js";
import { colorsHarmonize } from "../services/styling/rules-engine.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { recordGeminiUsage } from "../services/gemini-usage.js";
import { ImageAnalyzeBodySchema as AnalyzeBodySchema } from "../services/request-schemas.js";
import { normalizeCategory } from "../../src/shared/wardrobe-categories.js";

const geminiLimiter = rateLimitPerUser({ tag: "gemini" });

export const matchingRouter = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const GEMINI_TIMEOUT_MS = 10_000;

interface GarmentBreakdown {
  garments: Array<{
    category: string;
    color: string;
    pattern: string;
    fabric: string;
    description: string;
  }>;
}

const GARMENT_CATEGORIES = [
  "tops",
  "bottoms",
  "jeans",
  "pants",
  "skirts",
  "dresses",
  "outerwear",
  "footwear",
  "accessories",
] as const;

const GarmentBreakdownSchema = z.object({
  garments: z.array(z.object({
    // Accept anything, then fold legacy names ("shoes") onto the canonical
    // wardrobe taxonomy so matches against WardrobeItem.category work.
    category: z
      .string()
      .transform((v) => normalizeCategory(v))
      .catch("tops"),
    color: z.string().min(1).catch("black"),
    pattern: z.string().min(1).catch("solid"),
    fabric: z.string().min(1).catch("unknown"),
    description: z.string().catch("Clothing item"),
  })).catch([]),
});

/**
 * A reference-photo garment labelled "bottoms" must match wardrobe rows in
 * any trouser-like section (the wardrobe taxonomy is more specific than the
 * reference breakdown needs to be). Exported for tests.
 */
export const MATCH_CATEGORY_GROUPS: Record<string, readonly string[]> = {
  bottoms: ["bottoms", "jeans", "pants", "skirts"],
  jeans: ["jeans", "bottoms"],
  pants: ["pants", "bottoms"],
  skirts: ["skirts", "bottoms"],
  footwear: ["footwear", "shoes"],
};

export function matchableCategories(garmentCategory: string): readonly string[] {
  return MATCH_CATEGORY_GROUPS[garmentCategory] ?? [garmentCategory];
}

// POST /api/matching/analyze — Upload reference photo, decompose into garments
matchingRouter.post("/analyze", geminiLimiter, async (req: Request, res: Response) => {
  try {
    const bodyParsed = AnalyzeBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { image, mimeType } = bodyParsed.data;

    if (!isConfiguredSecret(process.env.GEMINI_API_KEY)) {
      res.json({
        breakdown: [],
        recreations: [],
        message: "Reference matching needs Gemini configuration.",
      });
      return;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    recordGeminiUsage("reference-matching");
    const result = await withTimeout(
      model.generateContent(
        [
          `Analyze this outfit photo and break it down into individual garments.
Return ONLY valid JSON (no markdown fences):
{
  "garments": [
    {
      "category": "${GARMENT_CATEGORIES.join("|")}",
      "color": "primary color name",
      "pattern": "solid|striped|plaid|floral|etc",
      "fabric": "best guess fabric",
      "description": "brief description"
    }
  ]
}`,
          { inlineData: { mimeType, data: image } },
        ],
        { timeout: GEMINI_TIMEOUT_MS },
      ),
      GEMINI_TIMEOUT_MS,
      "Gemini reference matching timed out",
    );

    const text = result.response.text().trim();
    const breakdown = GarmentBreakdownSchema.parse(parseGeminiJson(text)) as GarmentBreakdown;

    // Find matches from user's wardrobe
    const userId = req.userId!;
    const wardrobe = isDemoUser(userId)
      ? getDemoWardrobe(userId)
      : await prisma.wardrobeItem.findMany({
          where: { userId },
        });

    const recreations = breakdown.garments.map((garment) => {
      // Find best matches per category group — wardrobe rows are normalized
      // at read time, but normalize again so legacy rows still match.
      const allowed = matchableCategories(garment.category);
      const categoryMatches = wardrobe.filter((w) =>
        allowed.includes(normalizeCategory(w.category)),
      );

      const scored = categoryMatches.map((item) => {
        let score = 0;
        if (item.colorPrimary === garment.color) score += 40;
        else if (colorsHarmonize(item.colorPrimary, garment.color)) score += 20;
        if (item.pattern === garment.pattern) score += 30;
        if (item.fabric === garment.fabric) score += 15;
        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);

      return {
        target: garment,
        matches: scored.slice(0, 3).map((s) => ({
          item: s.item,
          matchScore: s.score,
        })),
      };
    });

    // Assemble 2-3 complete recreation options
    const options = assembleRecreations(recreations, 3);

    res.json({ breakdown: breakdown.garments, recreations: options });
  } catch (err) {
    console.error("Matching error:", err);
    res.status(503).json({
      error: "matching_temporarily_unavailable",
      breakdown: [],
      recreations: [],
      analysisReliable: false,
    });
  }
});

interface RecreationMatch {
  target: GarmentBreakdown["garments"][0];
  matches: Array<{
    item: { id: string; category: string; colorPrimary: string; imageUrl: string; thumbnailUrl: string | null; subcategory: string | null };
    matchScore: number;
  }>;
}

function assembleRecreations(
  recreations: RecreationMatch[],
  maxOptions: number,
) {
  const options: Array<{
    name: string;
    items: Array<{ id: string; category: string; colorPrimary: string; imageUrl: string; thumbnailUrl: string | null; subcategory: string | null; matchScore: number }>;
    overallScore: number;
  }> = [];

  // Generate different combos by using different match indices
  for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
    const items: Array<{
      id: string;
      category: string;
      colorPrimary: string;
      imageUrl: string;
      thumbnailUrl: string | null;
      subcategory: string | null;
      matchScore: number;
    }> = [];
    let totalScore = 0;

    for (const rec of recreations) {
      const match = rec.matches[optIdx] ?? rec.matches[0];
      if (match) {
        items.push({
          id: match.item.id,
          category: match.item.category,
          colorPrimary: match.item.colorPrimary,
          imageUrl: match.item.imageUrl,
          thumbnailUrl: match.item.thumbnailUrl,
          subcategory: match.item.subcategory,
          matchScore: match.matchScore,
        });
        totalScore += match.matchScore;
      }
    }

    if (items.length > 0) {
      options.push({
        name: `Recreation ${optIdx + 1}`,
        items,
        overallScore: Math.round(totalScore / Math.max(items.length, 1)),
      });
    }
  }

  return options.filter((o) => o.items.length > 0);
}
