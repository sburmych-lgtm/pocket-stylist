import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { analyzeClothingImage } from "../services/gemini.js";
import { uploadImage } from "../services/cloudinary.js";

export const importRouter = Router();

// Temporary demo user — replaced by auth in Phase 2
const DEMO_USER_EMAIL = "demo@pocket-stylist.app";

async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Demo User" },
  });
}

// POST /api/import/analyze — Upload + analyze a single image
importRouter.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { image, mimeType, fileName } = req.body as {
      image: string;
      mimeType: string;
      fileName: string;
    };

    if (!image || !mimeType) {
      res.status(400).json({ error: "image and mimeType are required" });
      return;
    }

    // 1. Upload to Cloudinary (or mock)
    const { imageUrl, thumbnailUrl } = await uploadImage(image, mimeType);

    // 2. Analyze with Gemini
    let tags;
    try {
      tags = await analyzeClothingImage(image, mimeType);
    } catch (err) {
      console.error("Gemini analysis failed:", err);
      tags = {
        category: "tops",
        subcategory: "unknown",
        colorPrimary: "black",
        colorHex: "#000000",
        pattern: "solid",
        fabric: "cotton",
        formalityLevel: 3,
        season: "all",
        brand: null,
        confidence: 0,
      };
    }

    res.json({
      imageUrl,
      thumbnailUrl,
      tags,
      fileName,
    });
  } catch (err) {
    console.error("Import analyze error:", err);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// POST /api/import/save — Save analyzed items to wardrobe
importRouter.post("/save", async (req: Request, res: Response) => {
  try {
    const { items } = req.body as {
      items: Array<{
        imageUrl: string;
        thumbnailUrl: string;
        category: string;
        subcategory?: string;
        colorPrimary: string;
        colorHex?: string;
        pattern?: string;
        fabric?: string;
        formalityLevel?: number;
        season?: string;
        brand?: string;
        confidence?: number;
      }>;
    };

    if (!items?.length) {
      res.status(400).json({ error: "items array is required" });
      return;
    }

    const user = await ensureDemoUser();

    const created = await prisma.wardrobeItem.createMany({
      data: items.map((item) => ({
        userId: user.id,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        category: item.category,
        subcategory: item.subcategory ?? null,
        colorPrimary: item.colorPrimary,
        colorHex: item.colorHex ?? null,
        pattern: item.pattern ?? "solid",
        fabric: item.fabric ?? null,
        formalityLevel: item.formalityLevel ?? 3,
        season: item.season ?? "all",
        brand: item.brand ?? null,
        confidence: item.confidence ?? 0,
      })),
    });

    res.json({ saved: created.count });
  } catch (err) {
    console.error("Import save error:", err);
    res.status(500).json({ error: "Failed to save items" });
  }
});

// GET /api/import/wardrobe — Get all wardrobe items
importRouter.get("/wardrobe", async (_req: Request, res: Response) => {
  try {
    const user = await ensureDemoUser();
    const items = await prisma.wardrobeItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (err) {
    console.error("Wardrobe fetch error:", err);
    res.status(500).json({ error: "Failed to fetch wardrobe" });
  }
});
