import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { fetchWeather, getWeather, weatherToSeason } from "../services/styling/weather.js";
import { filterWardrobe } from "../services/styling/rules-engine.js";
import { generateOutfits } from "../services/styling/outfit-generator.js";
import { resolveTargetUser, wardrobeVisibilityWhere } from "../services/family.js";
import { getDemoWardrobe, getDemoPersona, isDemoUser } from "../services/demo-store.js";
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

// Exported for tests — these schemas are the request contract.
export const SuggestBodySchema = z
  .object({
    mood: z.object({
      energy: z.coerce.number().min(0).max(100),
      boldness: z.coerce.number().min(0).max(100),
    }),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    formalityMin: z.coerce.number().int().min(1).max(5).optional(),
    formalityMax: z.coerce.number().int().min(1).max(5).optional(),
    memberId: z.string().min(1).max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.lat === undefined) !== (value.lon === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["lat"],
        message: "lat_and_lon_must_be_provided_together",
      });
    }
    if (
      value.formalityMin !== undefined &&
      value.formalityMax !== undefined &&
      value.formalityMin > value.formalityMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["formalityMin"],
        message: "invalid_formality_range",
      });
    }
  });

export const OutfitFeedbackSchema = z.object({
  outfitId: z.string().min(1).max(64),
  liked: z.boolean(),
});

export const OutfitWearSchema = z.object({
  outfitId: z.string().min(1).max(64),
});

interface ColorEntry {
  name: string;
  hex: string;
}

export const stylingRouter = Router();

// POST /api/styling/suggest — Get outfit suggestions
stylingRouter.post(["/suggest", "/generate"], geminiLimiter, async (req: Request, res: Response) => {
  try {
    const parsedBody = SuggestBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { mood, lat, lon, formalityMin, formalityMax, memberId } = parsedBody.data;

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

    const hasRequestCoords = lat !== undefined && lon !== undefined;
    const hasSavedCoords = userProfile?.lat != null && userProfile?.lon != null;
    const locationSet = hasRequestCoords || hasSavedCoords;
    const effectiveLat = hasRequestCoords ? lat : userProfile?.lat;
    const effectiveLon = hasRequestCoords ? lon : userProfile?.lon;
    const fetchedWeather = await fetchWeather({
      lat: effectiveLat,
      lon: effectiveLon,
      timezone: userProfile?.timezone,
    });
    const weather = {
      ...fetchedWeather,
      location: userProfile?.city || fetchedWeather.location,
    };
    const weatherSeason = weatherToSeason(weather.temp);

    const formalityRange = {
      min: formalityMin ?? 1,
      max: formalityMax ?? 5,
    };

    const colorPalette = (userProfile?.colorPalette ?? undefined) as
      | ColorEntry[]
      | undefined;
    const avoidColors = (userProfile?.avoidColors ?? undefined) as
      | ColorEntry[]
      | undefined;
    const persona = isDemoUser(targetUserId)
      ? getDemoPersona(targetUserId)
      : normalizePersona(userProfile?.stylistPersona);

    // Get wardrobe
    const allItems = isDemoUser(targetUserId)
      ? getDemoWardrobe(targetUserId)
      : await prisma.wardrobeItem.findMany({
          where: wardrobeVisibilityWhere(userId, targetUserId),
        });

    if (allItems.length === 0) {
      res.json({
        outfits: [],
        weather,
        persona,
        locationSet,
        messageCode: "empty_wardrobe",
        message: "No items in wardrobe. Import some clothes first!",
      });
      return;
    }

    if (!locationSet) {
      res.json({
        outfits: [],
        weather,
        persona,
        locationSet: false,
        messageCode: "location_required",
        message: "Set your city or location before generating a weather-aware outfit.",
      });
      return;
    }

    // Filter by rules — pass real temperature + precipitation so the
    // fabric/category/footwear gates fire
    const rulesContext = {
      mood,
      weatherSeason,
      temp: weather.temp,
      condition: weather.condition,
      precipMm: weather.precipMm,
      formalityRange,
      avoidRecentDays: 7,
      colorPalette,
      avoidColors,
    };
    let candidates = filterWardrobe(allItems, rulesContext);
    let reusedRecentItems = false;
    if (candidates.length === 0) {
      candidates = filterWardrobe(allItems, {
        ...rulesContext,
        avoidRecentDays: 0,
      });
      reusedRecentItems = candidates.length > 0;
    }

    // Generate outfits. CRITICAL: do NOT fall back to allItems when the
    // weather filter returns empty — that's exactly how a wool coat ends up
    // in a 26°C suggestion. Instead, return an empty list with a friendly
    // message so the UI can prompt the user to add seasonally appropriate
    // pieces.
    if (candidates.length === 0) {
      res.json({
        outfits: [],
        weather,
        persona,
        locationSet,
        candidateCount: 0,
        messageCode: "no_candidates",
        message: `No items match today's weather (${Math.round(weather.temp)}°C, ${weather.condition}) and the selected occasion. Adjust filters or add suitable pieces.`,
      });
      return;
    }

    const generated = await generateOutfits(candidates, {
      mood,
      weatherSeason,
      temp: weather.temp,
      condition: weather.condition,
      precipMm: weather.precipMm,
      formalityRange,
      persona,
      colorSeason: userProfile?.colorSeason ?? null,
      colorPalette,
      avoidColors,
      genderMode: userProfile?.genderMode,
    });

    if (generated.length === 0) {
      res.json({
        outfits: [],
        weather,
        persona,
        locationSet,
        candidateCount: candidates.length,
        messageCode: "wardrobe_too_small",
        message: "Your wardrobe is too small to assemble a complete weather-safe outfit.",
      });
      return;
    }

    // Persist outfits so like/wear feedback and analytics have real rows to
    // point at. Demo users stay DB-free (id: null → FE disables feedback).
    let outfits: Array<(typeof generated)[number] & { id: string | null }>;
    if (isDemoUser(userId) || generated.length === 0 || targetUserId !== userId) {
      outfits = generated.map((o) => ({ ...o, id: null }));
    } else {
      outfits = await Promise.all(
        generated.map(async (o) => {
          try {
            const row = await prisma.outfit.create({
              data: {
                userId,
                name: o.name,
                stylingTip: o.stylingTip,
                confidence: o.confidence,
                items: {
                  create: o.items.map((it) => ({ wardrobeItemId: it.id })),
                },
              },
              select: { id: true },
            });
            return { ...o, id: row.id };
          } catch (err) {
            // Persistence is best-effort — a DB hiccup must not kill the
            // suggestion the user is waiting for.
            console.error("[styling] outfit persist failed:", err);
            return { ...o, id: null };
          }
        }),
      );
    }

    res.json({
      outfits,
      weather,
      persona,
      locationSet,
      candidateCount: candidates.length,
      ...(reusedRecentItems
        ? {
            messageCode: "recent_items_reused",
            message: "Some recently worn items were reused because the wardrobe is still small.",
          }
        : {}),
    });
  } catch (err) {
    console.error("Styling suggest error:", err);
    res.status(500).json({ error: "Failed to generate outfits" });
  }
});

// POST /api/styling/feedback — Record like/dislike (owner-only)
stylingRouter.post("/feedback", async (req: Request, res: Response) => {
  try {
    const parsed = OutfitFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const userId = req.userId!;
    if (isDemoUser(userId)) {
      res.json({ ok: true });
      return;
    }

    const { count } = await prisma.outfit.updateMany({
      where: { id: parsed.data.outfitId, userId },
      data: { liked: parsed.data.liked },
    });
    if (count === 0) {
      res.status(404).json({ error: "outfit_not_found" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// POST /api/styling/wear — Record wearing an outfit (owner-only)
stylingRouter.post("/wear", async (req: Request, res: Response) => {
  try {
    const parsed = OutfitWearSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const userId = req.userId!;
    if (isDemoUser(userId)) {
      res.json({ ok: true });
      return;
    }

    // Ownership gate: only the outfit's owner can log a wear — this is what
    // stops user A from corrupting user B's timesWorn/lastWornAt stats.
    const outfit = await prisma.outfit.findFirst({
      where: { id: parsed.data.outfitId, userId },
      include: { items: true },
    });
    if (!outfit) {
      res.status(404).json({ error: "outfit_not_found" });
      return;
    }

    await prisma.$transaction([
      prisma.outfitLog.create({
        data: { userId, outfitId: outfit.id },
      }),
      prisma.wardrobeItem.updateMany({
        where: {
          id: { in: outfit.items.map((oi) => oi.wardrobeItemId) },
          userId,
        },
        data: {
          lastWornAt: new Date(),
          timesWorn: { increment: 1 },
        },
      }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("Wear error:", err);
    res.status(500).json({ error: "Failed to record wear" });
  }
});

// GET /api/styling/weather — Get current weather
stylingRouter.get("/weather", async (req: Request, res: Response) => {
  try {
    const latRaw = parseFloat(req.query.lat as string);
    const lonRaw = parseFloat(req.query.lon as string);
    const lat = Number.isFinite(latRaw) && Math.abs(latRaw) <= 90 ? latRaw : 50.45;
    const lon = Number.isFinite(lonRaw) && Math.abs(lonRaw) <= 180 ? lonRaw : 30.52;
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
    if (msg === "tryon_timeout") {
      res.status(504).json({ error: "tryon_timeout" });
      return;
    }
    console.error("[tryon] error:", err);
    res.status(502).json({ error: "tryon_failed" });
  }
});
