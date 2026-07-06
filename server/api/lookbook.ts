import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { getWeatherForecast, weatherToSeason } from "../services/styling/weather.js";
import { filterWardrobe } from "../services/styling/rules-engine.js";
import { generateOutfits } from "../services/styling/outfit-generator.js";
import type { WardrobeItem } from "../../src/generated/prisma/client.js";
import { resolveTargetUser, wardrobeVisibilityWhere } from "../services/family.js";
import { getDemoWardrobe, getDemoPersona, isDemoUser } from "../services/demo-store.js";
import { normalizePersona, type StylistPersona } from "../services/styling/personas.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";

export const lookbookRouter = Router();

const coordinatePairRefinement = (
  value: { lat?: number; lon?: number },
  ctx: z.RefinementCtx,
): void => {
  if ((value.lat === undefined) !== (value.lon === undefined)) {
    ctx.addIssue({ code: "custom", path: ["lat"], message: "lat_and_lon_required_together" });
  }
};

const GenerateBodySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    memberId: z.string().min(1).max(64).optional(),
  })
  .superRefine(coordinatePairRefinement);

const WearBodySchema = z.object({
  itemIds: z.array(z.string().min(1).max(64)).min(1).max(20),
});

const RegenerateBodySchema = z
  .object({
    dayIndex: z.number().int().min(0).max(6),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    excludeItemIds: z.array(z.string().min(1).max(64)).max(50).optional(),
  })
  .superRefine(coordinatePairRefinement);

const lookbookLimiter = rateLimitPerUser({
  tag: "lookbook",
  limit: 12,
  windowMs: 60 * 60_000,
});

interface ColorEntry {
  name: string;
  hex: string;
}

interface LookbookDay {
  date: string;
  weather: {
    temp: number;
    feelsLike: number;
    condition: string;
    icon: string;
    location: string;
    source: "live" | "mock";
  };
  outfit: {
    name: string;
    items: WardrobeItem[];
    stylingTip: string;
    confidence: number;
  } | null;
}

interface LookbookUserContext {
  persona: StylistPersona;
  colorSeason: string | null;
  colorPalette?: ColorEntry[];
  avoidColors?: ColorEntry[];
  genderMode?: string;
  lat: number | null;
  lon: number | null;
  city: string | null;
  timezone: string | null;
}

/** Load styling context for a user; demo users are DB-free. */
async function loadUserContext(targetUserId: string): Promise<LookbookUserContext> {
  if (isDemoUser(targetUserId)) {
    return {
      persona: getDemoPersona(targetUserId),
      colorSeason: null,
      lat: null,
      lon: null,
      city: null,
      timezone: null,
    };
  }
  const profile = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      colorSeason: true,
      colorPalette: true,
      avoidColors: true,
      genderMode: true,
      stylistPersona: true,
      lat: true,
      lon: true,
      city: true,
      timezone: true,
    },
  });
  return {
    persona: normalizePersona(profile?.stylistPersona),
    colorSeason: profile?.colorSeason ?? null,
    colorPalette: (profile?.colorPalette ?? undefined) as ColorEntry[] | undefined,
    avoidColors: (profile?.avoidColors ?? undefined) as ColorEntry[] | undefined,
    genderMode: profile?.genderMode,
    lat: profile?.lat ?? null,
    lon: profile?.lon ?? null,
    city: profile?.city ?? null,
    timezone: profile?.timezone ?? null,
  };
}

async function loadWardrobe(
  targetUserId: string,
  requestorId: string,
): Promise<WardrobeItem[]> {
  if (isDemoUser(targetUserId)) {
    return getDemoWardrobe(targetUserId);
  }
  return prisma.wardrobeItem.findMany({
    where: wardrobeVisibilityWhere(requestorId, targetUserId),
  });
}

// POST /api/lookbook/generate — Generate 7-day lookbook
lookbookRouter.post("/generate", lookbookLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const parsed = GenerateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { lat, lon, memberId } = parsed.data;

    // Resolve target user (self or family member). Demo users skip the
    // family lookup entirely — it would 500 without a DB row.
    const { targetUserId, error: memberError } = isDemoUser(userId)
      ? { targetUserId: userId, error: undefined }
      : await resolveTargetUser(userId, memberId);
    if (memberError) {
      res.status(403).json({ error: memberError });
      return;
    }

    const userCtx = await loadUserContext(targetUserId);
    const hasRequestCoords = lat !== undefined && lon !== undefined;
    const hasSavedCoords = userCtx.lat != null && userCtx.lon != null;

    const allItems = await loadWardrobe(targetUserId, userId);

    if (allItems.length === 0) {
      res.json({
        days: [],
        weekStart: getWeekStart().toISOString(),
        persona: userCtx.persona,
        messageCode: "empty_wardrobe",
        message: "No items in wardrobe. Import some clothes first!",
      });
      return;
    }

    if (!hasRequestCoords && !hasSavedCoords) {
      res.json({
        days: [],
        weekStart: getWeekStart().toISOString(),
        persona: userCtx.persona,
        messageCode: "location_required",
        message: "Set your city or location before generating a lookbook.",
      });
      return;
    }

    const userLat = hasRequestCoords ? lat : userCtx.lat!;
    const userLon = hasRequestCoords ? lon : userCtx.lon!;

    // Get 7-day forecast
    const forecast = await getWeatherForecast(userLat, userLon);
    // Track used items for anti-repeat
    const usedItemsByDay: Set<string>[] = [];
    const usedThisWeek = new Set<string>();

    const days: LookbookDay[] = [];

    for (let i = 0; i < 7; i++) {
      const dayWeather = forecast[i] ?? forecast[forecast.length - 1];
      const dateStr = dayWeather.daily[i]?.date ?? dayWeather.daily[0]?.date;
      if (!dateStr) {
        throw new Error("forecast_date_missing");
      }
      const weatherSeason = weatherToSeason(dayWeather.temp);

      // Build set of items used in the previous day (consecutive anti-repeat)
      const previousDayItems = i > 0 ? usedItemsByDay[i - 1] : new Set<string>();

      // Filter candidates, excluding items used the previous day
      const weatherCandidates = filterWardrobe(allItems, {
        mood: { energy: 50, boldness: 50 },
        weatherSeason,
        temp: dayWeather.temp,
        condition: dayWeather.condition,
        precipMm: dayWeather.precipMm,
        formalityRange: { min: 1, max: 5 },
        avoidRecentDays: 0, // Don't filter by lastWornAt for lookbook planning
        colorPalette: userCtx.colorPalette,
        avoidColors: userCtx.avoidColors,
      });
      const unusedCandidates = weatherCandidates.filter(
        (item) => !usedThisWeek.has(item.id),
      );
      const reusableCategories = new Set(["footwear", "shoes", "outerwear"]);
      const relaxedCandidates = weatherCandidates.filter(
        (item) =>
          !previousDayItems.has(item.id) || reusableCategories.has(item.category),
      );
      const candidates =
        unusedCandidates.length > 0 ? unusedCandidates : relaxedCandidates;

      // No fallback to allItems — surfacing winter coats on a hot day is
      // exactly the bug we're closing. If there's nothing seasonally
      // appropriate left, the day shows outfit:null and the UI prompts
      // the user to import suitable items.
      if (candidates.length === 0) {
        usedItemsByDay.push(new Set());
        days.push(makeDay(dateStr, dayWeather, null));
        continue;
      }

      try {
        const generationContext = {
          mood: { energy: 50, boldness: 50 },
          weatherSeason,
          temp: dayWeather.temp,
          condition: dayWeather.condition,
          precipMm: dayWeather.precipMm,
          formalityRange: { min: 1, max: 5 },
          persona: userCtx.persona,
          colorSeason: userCtx.colorSeason,
          colorPalette: userCtx.colorPalette,
          avoidColors: userCtx.avoidColors,
          genderMode: userCtx.genderMode,
        };
        let outfits = await generateOutfits(
          candidates,
          generationContext,
          1,
          { useAi: i === 0 },
        );
        if (outfits.length === 0 && candidates !== relaxedCandidates) {
          outfits = await generateOutfits(
            relaxedCandidates,
            generationContext,
            1,
            { useAi: false },
          );
        }
        if (outfits.length === 0 && relaxedCandidates.length !== weatherCandidates.length) {
          outfits = await generateOutfits(
            weatherCandidates,
            generationContext,
            1,
            { useAi: false },
          );
        }

        const outfit = outfits[0] ?? null;
        const dayUsed = new Set<string>();
        if (outfit) {
          for (const item of outfit.items) {
            dayUsed.add(item.id);
            usedThisWeek.add(item.id);
          }
        }
        usedItemsByDay.push(dayUsed);
        days.push(makeDay(dateStr, dayWeather, outfit));
      } catch {
        usedItemsByDay.push(new Set());
        days.push(makeDay(dateStr, dayWeather, null));
      }
    }

    res.json({ days, weekStart: getWeekStart().toISOString(), persona: userCtx.persona });
  } catch (err) {
    console.error("Lookbook generate error:", err);
    res.status(500).json({ error: "Failed to generate lookbook" });
  }
});

function makeDay(
  dateStr: string,
  dayWeather: {
    temp: number;
    feelsLike: number;
    condition: string;
    icon: string;
    location: string;
    source: "live" | "mock";
  },
  outfit: LookbookDay["outfit"],
): LookbookDay {
  return {
    date: dateStr,
    weather: {
      temp: dayWeather.temp,
      feelsLike: dayWeather.feelsLike,
      condition: dayWeather.condition,
      icon: dayWeather.icon,
      location: dayWeather.location,
      source: dayWeather.source,
    },
    outfit,
  };
}

// GET /api/lookbook/current — Get current week's lookbook (most recent generation)
lookbookRouter.get("/current", async (_req: Request, res: Response) => {
  // Lookbook is generated on demand and not persisted.
  // Return empty to indicate no saved lookbook.
  res.json({ days: null });
});

// POST /api/lookbook/:dayIndex/wear — Log wearing outfit for a specific day
lookbookRouter.post("/:dayIndex/wear", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const dayParam = Array.isArray(req.params.dayIndex)
      ? req.params.dayIndex[0]
      : req.params.dayIndex;
    const dayIndex = parseInt(dayParam, 10);
    if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      res.status(400).json({ error: "Invalid day index (0-6)" });
      return;
    }

    const parsed = WearBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    if (isDemoUser(userId)) {
      res.json({ ok: true });
      return;
    }

    // Single scoped updateMany — the userId constraint is the ownership
    // check, so foreign item ids are silently ignored.
    await prisma.wardrobeItem.updateMany({
      where: { id: { in: parsed.data.itemIds }, userId },
      data: {
        lastWornAt: new Date(),
        timesWorn: { increment: 1 },
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Lookbook wear error:", err);
    res.status(500).json({ error: "Failed to record wear" });
  }
});

// POST /api/lookbook/regenerate-day — Regenerate outfit for a single day
lookbookRouter.post("/regenerate-day", lookbookLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const parsed = RegenerateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { dayIndex, lat, lon, excludeItemIds } = parsed.data;
    const excluded = new Set(excludeItemIds ?? []);

    const userCtx = await loadUserContext(userId);
    const hasRequestCoords = lat !== undefined && lon !== undefined;
    const hasSavedCoords = userCtx.lat != null && userCtx.lon != null;
    if (!hasRequestCoords && !hasSavedCoords) {
      res.status(409).json({ error: "location_required" });
      return;
    }
    const userLat = hasRequestCoords ? lat : userCtx.lat!;
    const userLon = hasRequestCoords ? lon : userCtx.lon!;

    const allItems = await loadWardrobe(userId, userId);

    // Weather for the SPECIFIC day being regenerated — using today's
    // conditions for day 5 used to suggest T-shirts ahead of a cold front.
    const forecast = await getWeatherForecast(userLat, userLon);
    const dayWeather = forecast[dayIndex] ?? forecast[forecast.length - 1];
    const weatherSeason = weatherToSeason(dayWeather.temp);

    const candidates = filterWardrobe(allItems, {
      mood: { energy: 50, boldness: 50 },
      weatherSeason,
      temp: dayWeather.temp,
      condition: dayWeather.condition,
      precipMm: dayWeather.precipMm,
      formalityRange: { min: 1, max: 5 },
      avoidRecentDays: 0,
      colorPalette: userCtx.colorPalette,
      avoidColors: userCtx.avoidColors,
    }).filter((item) => !excluded.has(item.id));

    // No allItems fallback — see comment in /generate above.
    if (candidates.length === 0) {
      res.json({ outfit: null });
      return;
    }

    const outfits = await generateOutfits(candidates, {
      mood: { energy: 50, boldness: 50 },
      weatherSeason,
      temp: dayWeather.temp,
      condition: dayWeather.condition,
      precipMm: dayWeather.precipMm,
      formalityRange: { min: 1, max: 5 },
      persona: userCtx.persona,
      colorSeason: userCtx.colorSeason,
      colorPalette: userCtx.colorPalette,
      avoidColors: userCtx.avoidColors,
      genderMode: userCtx.genderMode,
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
