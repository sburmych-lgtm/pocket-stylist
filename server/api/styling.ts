import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { getWeather, weatherToSeason } from "../services/styling/weather.js";
import { filterWardrobe } from "../services/styling/rules-engine.js";
import { generateOutfits } from "../services/styling/outfit-generator.js";
import { resolveTargetUser } from "../services/family.js";
import { getDemoWardrobe, isDemoUser } from "../services/demo-store.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { runTryOn } from "../services/styling/tryon.js";
import { normalizePersona } from "../services/styling/personas.js";
import { z } from "zod";

const geminiLimiter = rateLimitPerUser({ tag: "gemini" });
// Try-on is far more expensive per call (~$0.05) than Gemini. Hard cap users
// at 10 generations / rolling 24h until paid tiers exist.
const falLimiter = rateLimitPerUser({ tag: "fal", limit: 10 });

const TryOnRequestSchema = z.object({
  modelImage: z.string().min(8).max(8_000_000),
  garmentImage: z.string().min(8).max(8_000_000),
});

export const stylingRouter = Router();

// POST /api/styling/suggest — Get outfit suggestions
stylingRouter.post("/suggest", geminiLimiter, async (req: Request, res: Response) => {
  try {
    const {
      mood,
      lat,
      lon,
      formalityMin,
      formalityMax,
      memberId,
    } = req.body as {
      mood: { energy: number; boldness: number };
      lat?: number;
      lon?: number;
      formalityMin?: number;
      formalityMax?: number;
      memberId?: string;
    };

    if (!mood) {
      res.status(400).json({ error: "mood is required" });
      return;
    }

    // Resolve target user (self or family member)
    const userId = req.userId!;
    const { targetUserId, error: memberError } = isDemoUser(userId)
      ? { targetUserId: userId, error: undefined }
      : await resolveTargetUser(userId, memberId);
    if (memberError) {
      res.status(403).json({ error: memberError });
      return;
    }

    // Get target user with color data + stylist persona (drives Gemini voice)
    // + saved location so the request falls back to the user's coords when
    // the client didn't send any.
    const userProfile = isDemoUser(targetUserId)
      ? null
      : await prisma.user.findUnique({
          where: { id: targetUserId },
          select: {
            colorPalette: true,
            avoidColors: true,
            stylistPersona: true,
            lat: true,
            lon: true,
            timezone: true,
          },
        });

    // Get weather — prefer explicit lat/lon, then saved profile, then Kyiv.
    const effectiveLat = lat ?? userProfile?.lat ?? 50.45;
    const effectiveLon = lon ?? userProfile?.lon ?? 30.52;
    const weather = await getWeather(effectiveLat, effectiveLon);
    const weatherSeason = weatherToSeason(weather.temp);

    const formalityRange = {
      min: formalityMin ?? 1,
      max: formalityMax ?? 5,
    };

    const colorPalette = (userProfile?.colorPalette ?? undefined) as
      | Array<{ name: string; hex: string }>
      | undefined;
    const avoidColors = (userProfile?.avoidColors ?? undefined) as
      | Array<{ name: string; hex: string }>
      | undefined;
    const persona = normalizePersona(userProfile?.stylistPersona);

    // Get wardrobe
    const allItems = isDemoUser(targetUserId)
      ? getDemoWardrobe(targetUserId)
      : await prisma.wardrobeItem.findMany({
          where: { userId: targetUserId },
        });

    if (allItems.length === 0) {
      res.json({
        outfits: [],
        weather,
        message: "No items in wardrobe. Import some clothes first!",
      });
      return;
    }

    // Filter by rules — pass real temperature so the fabric/category gates fire
    const candidates = filterWardrobe(allItems, {
      mood,
      weatherSeason,
      temp: weather.temp,
      formalityRange,
      avoidRecentDays: 7,
      colorPalette,
      avoidColors,
    });

    // Generate outfits. CRITICAL: do NOT fall back to allItems when the
    // weather filter returns empty — that's exactly how a wool coat ends up
    // in a 26°C suggestion. Instead, return an empty list with a friendly
    // message so the UI can prompt the user to add seasonally appropriate
    // pieces.
    if (candidates.length === 0) {
      res.json({
        outfits: [],
        weather,
        candidateCount: 0,
        message: `No items match today's weather (${Math.round(weather.temp)}°C, ${weather.condition}). Add seasonally appropriate pieces and try again.`,
      });
      return;
    }

    const outfits = await generateOutfits(candidates, {
      mood,
      weatherSeason,
      temp: weather.temp,
      condition: weather.condition,
      formalityRange,
      persona,
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

// POST /api/styling/tryon — virtual try-on via Fal.ai
// Body: { modelImage, garmentImage } — both can be HTTPS URLs OR data URLs.
// Returns: { imageUrl, durationMs }
stylingRouter.post("/tryon", falLimiter, async (req: Request, res: Response) => {
  const parsed = TryOnRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  try {
    const result = await runTryOn({
      modelImage: parsed.data.modelImage,
      garmentImage: parsed.data.garmentImage,
    });

    // Persist for analytics / cost tracking. Best-effort — a DB hiccup
    // shouldn't kill the response since we already paid Fal for the call.
    const userId = req.userId!;
    if (!isDemoUser(userId)) {
      prisma.outfitRender
        .create({
          data: {
            userId,
            modelImageUrl: parsed.data.modelImage.startsWith("data:")
              ? "[base64]"
              : parsed.data.modelImage.slice(0, 1024),
            garmentImageUrl: parsed.data.garmentImage.startsWith("data:")
              ? "[base64]"
              : parsed.data.garmentImage.slice(0, 1024),
            resultImageUrl: result.imageUrl,
            durationMs: result.durationMs,
          },
        })
        .catch((err) => console.error("[tryon] persist failed:", err));
    }

    res.json({ imageUrl: result.imageUrl, durationMs: result.durationMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "tryon_failed";
    if (msg === "tryon_not_configured") {
      res.status(503).json({ error: "tryon_not_configured" });
      return;
    }
    console.error("[tryon] error:", err);
    res.status(502).json({ error: "tryon_failed" });
  }
});
