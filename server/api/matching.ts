import { Router } from "express";
import type { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../services/prisma.js";
import { colorsHarmonize } from "../services/styling/rules-engine.js";

export const matchingRouter = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

interface GarmentBreakdown {
  garments: Array<{
    category: string;
    color: string;
    pattern: string;
    fabric: string;
    description: string;
  }>;
}

// POST /api/matching/analyze — Upload reference photo, decompose into garments
matchingRouter.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { image, mimeType } = req.body as {
      image: string;
      mimeType: string;
    };

    if (!image || !mimeType) {
      res.status(400).json({ error: "image and mimeType are required" });
      return;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      `Analyze this outfit photo and break it down into individual garments.
Return ONLY valid JSON (no markdown fences):
{
  "garments": [
    {
      "category": "tops|bottoms|dresses|outerwear|shoes|accessories",
      "color": "primary color name",
      "pattern": "solid|striped|plaid|floral|etc",
      "fabric": "best guess fabric",
      "description": "brief description"
    }
  ]
}`,
      { inlineData: { mimeType, data: image } },
    ]);

    const text = result.response.text().trim();
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const breakdown = JSON.parse(json) as GarmentBreakdown;

    // Find matches from user's wardrobe
    const userId = req.userId!;
    const wardrobe = await prisma.wardrobeItem.findMany({
      where: { userId },
    });

    const recreations = breakdown.garments.map((garment) => {
      // Find best matches per category
      const categoryMatches = wardrobe.filter(
        (w) => w.category === garment.category,
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
    res.status(500).json({ error: "Failed to analyze reference photo" });
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
