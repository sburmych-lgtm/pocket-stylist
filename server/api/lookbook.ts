import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { getWeatherForecast, getWeather, weatherToSeason } from "../services/styling/weather.js";
import { filterWardrobe } from "../services/styling/rules-engine.js";
import { generateOutfits } from "../services/styling/outfit-generator.js";
import type { WardrobeItem } from "../../src/generated/prisma/client.js";
import { resolveTargetUser } from "../services/family.js";

export const lookbookRouter = Router();

interface LookbookDay {
  date: string;
  weather: {
    temp: number;
    feelsLike: number;
    condition: string;
    icon: string;
    location: string;
  };
  outfit: {
    name: string;
    items: WardrobeItem[];
    stylingTip: string;
    confidence: number;
  } | null;
}

interface LookbookResponse {
  days: LookbookDay[];
  weekStart: string;
}

// POST /api/lookbook/generate — Generate 7-day lookbook
lookbookRouter.post("/generate", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { lat, lon, memberId } = req.body as {
      lat?: number;
      lon?: number;
      memberId?: string;
    };

    // Resolve target user (self or family member)
    const { targetUserId, error: memberError } = await resolveTargetUser(userId, memberId);
    if (memberError) {
      res.status(403).json({ error: memberError });
      return;
    }

    const userLat = lat ?? 50.45;
    const userLon = lon ?? 30.52;

    // Get target user profile for color data
    const userProfile = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { colorPalette: true, avoidColors: true },
    });

    const colorPalette = (userProfile?.colorPalette ?? undefined) as
      | Array<{ name: string; hex: string }>
      | undefined;
    const avoidColors = (userProfile?.avoidColors ?? undefined) as
      | Array<{ name: string; hex: string }>
      | undefined;

    // Get full wardrobe
    const allItems = await prisma.wardrobeItem.findMany({
      where: { userId: targetUserId },
    });

    if (allItems.length === 0) {
      res.json({
        days: [],
        weekStart: getWeekStart().toISOString(),
        message: "No items in wardrobe. Import some clothes first!",
      });
      return;
    }

    // Get 7-day forecast
    const forecast = await getWeatherForecast(userLat, userLon);
    const today = new Date();

    // Track used items for anti-repeat
    const usedItemsByDay: Set<string>[] = [];

    const days: LookbookDay[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      const dayWeather = forecast[i] ?? forecast[forecast.length - 1];
      const weatherSeason = weatherToSeason(dayWeather.temp);

      // Build set of items used in the previous day (consecutive anti-repeat)
      const previousDayItems = i > 0 ? usedItemsByDay[i - 1] : new Set<string>();

      // Filter candidates, excluding items used the previous day
      const candidates = filterWardrobe(allItems, {
        mood: { energy: 50, boldness: 50 },
        weatherSeason,
        formalityRange: { min: 1, max: 5 },
        avoidRecentDays: 0, // Don't filter by lastWornAt for lookbook planning
        colorPalette,
        avoidColors,
      }).filter((item) => !previousDayItems.has(item.id));

      const pool = candidates.length > 0 ? candidates : allItems;

      try {
        const outfits = await generateOutfits(pool, {
          mood: { energy: 50, boldness: 50 },
          weatherSeason,
          formalityRange: { min: 1, max: 5 },
        }, 1);

        const outfit = outfits[0] ?? null;
        const dayUsed = new Set<string>();
        if (outfit) {
          for (const item of outfit.items) {
            dayUsed.add(item.id);
          }
        }
        usedItemsByDay.push(dayUsed);

        days.push({
          date: dateStr,
          weather: {
            temp: dayWeather.temp,
            feelsLike: dayWeather.feelsLike,
            condition: dayWeather.condition,
            icon: dayWeather.icon,
            location: dayWeather.location,
          },
          outfit,
        });
      } catch {
        usedItemsByDay.push(new Set());
        days.push({
          date: dateStr,
          weather: {
            temp: dayWeather.temp,
            feelsLike: dayWeather.feelsLike,
            condition: dayWeather.condition,
            icon: dayWeather.icon,
            location: dayWeather.location,
          },
          outfit: null,
        });
      }
    }

    res.json({ days, weekStart: getWeekStart().toISOString() });
  } catch (err) {
    console.error("Lookbook generate error:", err);
    res.status(500).json({ error: "Failed to generate lookbook" });
  }
});

// GET /api/lookbook/current — Get current week's lookbook (most recent generation)
lookbookRouter.get("/current", async (req: Request, res: Response) => {
  try {
    // For now, lookbook is generated on demand and not persisted.
    // Return empty to indicate no saved lookbook.
    res.json({ days: null });
  } catch (err) {
    console.error("Lookbook current error:", err);
    res.status(500).json({ error: "Failed to fetch lookbook" });
  }
});

// POST /api/lookbook/:dayIndex/wear — Log wearing outfit for a specific day
lookbookRouter.post("/:dayIndex/wear", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const dayParam = Array.isArray(req.params.dayIndex)
      ? req.params.dayIndex[0]
      : req.params.dayIndex;
    const dayIndex = parseInt(dayParam, 10);
    const { itemIds } = req.body as { itemIds: string[] };

    if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      res.status(400).json({ error: "Invalid day index (0-6)" });
      return;
    }

    if (!itemIds || itemIds.length === 0) {
      res.status(400).json({ error: "itemIds required" });
      return;
    }

    // Update lastWornAt and timesWorn for each item
    await Promise.all(
      itemIds.map((id) =>
        prisma.wardrobeItem.updateMany({
          where: { id, userId },
          data: {
            lastWornAt: new Date(),
            timesWorn: { increment: 1 },
          },
        }),
      ),
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Lookbook wear error:", err);
    res.status(500).json({ error: "Failed to record wear" });
  }
});

// POST /api/lookbook/regenerate-day — Regenerate outfit for a single day
lookbookRouter.post("/regenerate-day", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { dayIndex, lat, lon, excludeItemIds } = req.body as {
      dayIndex: number;
      lat?: number;
      lon?: number;
      excludeItemIds?: string[];
    };

    if (typeof dayIndex !== "number" || dayIndex < 0 || dayIndex > 6) {
      res.status(400).json({ error: "Invalid dayIndex (0-6)" });
      return;
    }

    const userLat = lat ?? 50.45;
    const userLon = lon ?? 30.52;
    const excluded = new Set(excludeItemIds ?? []);

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

    const allItems = await prisma.wardrobeItem.findMany({
      where: { userId },
    });

    // Get weather for the specific day
    const weather = await getWeather(userLat, userLon);
    const weatherSeason = weatherToSeason(weather.temp);

    const candidates = filterWardrobe(allItems, {
      mood: { energy: 50, boldness: 50 },
      weatherSeason,
      formalityRange: { min: 1, max: 5 },
      avoidRecentDays: 0,
      colorPalette,
      avoidColors,
    }).filter((item) => !excluded.has(item.id));

    const pool = candidates.length > 0 ? candidates : allItems;
    const outfits = await generateOutfits(pool, {
      mood: { energy: 50, boldness: 50 },
      weatherSeason,
      formalityRange: { min: 1, max: 5 },
    }, 1);

    res.json({ outfit: outfits[0] ?? null });
  } catch (err) {
    console.error("Lookbook regenerate-day error:", err);
    res.status(500).json({ error: "Failed to regenerate day" });
  }
});

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
