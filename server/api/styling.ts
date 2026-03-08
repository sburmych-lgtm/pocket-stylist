import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { getWeather, weatherToSeason } from "../services/styling/weather.js";
import { filterWardrobe } from "../services/styling/rules-engine.js";
import { generateOutfits } from "../services/styling/outfit-generator.js";

export const stylingRouter = Router();

// POST /api/styling/suggest — Get outfit suggestions
stylingRouter.post("/suggest", async (req: Request, res: Response) => {
  try {
    const {
      mood,
      lat,
      lon,
      formalityMin,
      formalityMax,
    } = req.body as {
      mood: { energy: number; boldness: number };
      lat?: number;
      lon?: number;
      formalityMin?: number;
      formalityMax?: number;
    };

    if (!mood) {
      res.status(400).json({ error: "mood is required" });
      return;
    }

    // Get weather
    const weather = await getWeather(lat ?? 50.45, lon ?? 30.52); // Default: Kyiv
    const weatherSeason = weatherToSeason(weather.temp);

    const formalityRange = {
      min: formalityMin ?? 1,
      max: formalityMax ?? 5,
    };

    // Get user with color data
    const userId = req.userId!;
    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { colorPalette: true, avoidColors: true },
    });

    const colorPalette = (userProfile?.colorPalette ?? undefined) as
      | Array<{ name: string; hex: string }>
      | undefined;
    const avoidColors = (userProfile?.avoidColors ?? undefined) as
      | Array<{ name: string; hex: string }>
      | undefined;

    // Get wardrobe
    const allItems = await prisma.wardrobeItem.findMany({
      where: { userId },
    });

    if (allItems.length === 0) {
      res.json({
        outfits: [],
        weather,
        message: "No items in wardrobe. Import some clothes first!",
      });
      return;
    }

    // Filter by rules
    const candidates = filterWardrobe(allItems, {
      mood,
      weatherSeason,
      formalityRange,
      avoidRecentDays: 7,
      colorPalette,
      avoidColors,
    });

    // Generate outfits
    const outfits = await generateOutfits(candidates.length > 0 ? candidates : allItems, {
      mood,
      weatherSeason,
      formalityRange,
    });

    res.json({ outfits, weather, candidateCount: candidates.length });
  } catch (err) {
    console.error("Styling suggest error:", err);
    res.status(500).json({ error: "Failed to generate outfits" });
  }
});

// POST /api/styling/feedback — Record like/dislike
stylingRouter.post("/feedback", async (req: Request, res: Response) => {
  try {
    const { outfitId, liked } = req.body as {
      outfitId: string;
      liked: boolean;
    };

    await prisma.outfit.update({
      where: { id: outfitId },
      data: { liked },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// POST /api/styling/wear — Record wearing an outfit
stylingRouter.post("/wear", async (req: Request, res: Response) => {
  try {
    const { outfitId } = req.body as { outfitId: string };
    const userId = req.userId!;

    // Log the wear
    await prisma.outfitLog.create({
      data: { userId, outfitId },
    });

    // Update lastWornAt and timesWorn on each item
    const outfit = await prisma.outfit.findUnique({
      where: { id: outfitId },
      include: { items: true },
    });

    if (outfit) {
      await Promise.all(
        outfit.items.map((oi) =>
          prisma.wardrobeItem.update({
            where: { id: oi.wardrobeItemId },
            data: {
              lastWornAt: new Date(),
              timesWorn: { increment: 1 },
            },
          }),
        ),
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Wear error:", err);
    res.status(500).json({ error: "Failed to record wear" });
  }
});

// GET /api/styling/weather — Get current weather
stylingRouter.get("/weather", async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string) || 50.45;
    const lon = parseFloat(req.query.lon as string) || 30.52;
    const weather = await getWeather(lat, lon);
    res.json(weather);
  } catch (err) {
    console.error("Weather error:", err);
    res.status(500).json({ error: "Failed to fetch weather" });
  }
});
