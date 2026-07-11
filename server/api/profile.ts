import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { analyzeColorType } from "../services/color-analysis.js";
import type { ColorAnalysisResult } from "../services/color-analysis.js";
import {
  DEMO_USER,
  isDemoUser,
  getDemoPersona,
  setDemoPersona,
} from "../services/demo-store.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { requirePaidOrTrial } from "../middleware/require-access.js";
import { geocodeCity, reverseGeocodeCoords } from "../services/styling/weather.js";
import { deleteImage } from "../services/cloudinary.js";
import {
  STYLIST_PERSONAS,
  normalizePersona,
  type StylistPersona,
} from "../services/styling/personas.js";

const geminiLimiter = rateLimitPerUser({ tag: "gemini" });

export const profileRouter = Router();

/* ---------- Persona schema ---------- */

const PersonaBodySchema = z.object({
  persona: z.enum(STYLIST_PERSONAS),
});

/* ---------- Location schemas ---------- */

const LocationCoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  city: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

const LocationCitySchema = z.object({
  city: z.string().min(1).max(120),
});

// Either explicit coords (with optional city/timezone) or a city to geocode.
const LocationBodySchema = z.union([LocationCoordsSchema, LocationCitySchema]);

const ProfilePatchSchema = z
  .object({
    genderMode: z.enum(["neutral", "male", "female"]).optional(),
    name: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const ColorAnalysisBodySchema = z.object({
  image: z.string().min(8).max(15_000_000),
});

interface LocationFields {
  lat: number | null;
  lon: number | null;
  city: string | null;
  timezone: string | null;
}

// Demo users don't hit the DB — keep their location in-memory so the
// LocationRequest banner can still toggle off after they "set" a city.
const demoLocation: Record<string, LocationFields> = {};

// GET /api/profile — Return user profile with color data + stylist persona
profileRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    if (isDemoUser(userId)) {
      res.json({
        ...DEMO_USER,
        stylistPersona: getDemoPersona(userId),
        ...(demoLocation[userId] ?? { lat: null, lon: null, city: null, timezone: null }),
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        genderMode: true,
        colorSeason: true,
        colorPalette: true,
        avoidColors: true,
        stylistPersona: true,
        lat: true,
        lon: true,
        city: true,
        timezone: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Normalize persona so a row with a legacy/unknown value still serves
    // a valid one to the client (the union type guarantees safe routing).
    res.json({
      ...user,
      stylistPersona: normalizePersona(user.stylistPersona),
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/profile/persona — Update the stylist voice persona.
profileRouter.patch("/persona", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const parsed = PersonaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    const persona: StylistPersona = parsed.data.persona;

    if (isDemoUser(userId)) {
      setDemoPersona(userId, persona);
      res.json({ stylistPersona: persona });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { stylistPersona: persona },
      select: { stylistPersona: true },
    });
    res.json({ stylistPersona: normalizePersona(user.stylistPersona) });
  } catch (err) {
    console.error("Persona update error:", err);
    res.status(500).json({ error: "Failed to update persona" });
  }
});

// GET /api/profile/location — Return current location (used by client to
// decide whether to render the LocationRequest banner).
profileRouter.get("/location", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    if (isDemoUser(userId)) {
      const loc = demoLocation[userId] ?? { lat: null, lon: null, city: null, timezone: null };
      res.json(loc);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lat: true, lon: true, city: true, timezone: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error("Location fetch error:", err);
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

// PATCH /api/profile/location — Update user location.
// Accepts either `{ lat, lon, city?, timezone? }` from browser geolocation,
// or `{ city }` alone, in which case we geocode via Open-Meteo.
profileRouter.patch("/location", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const parsed = LocationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    let payload: LocationFields;
    if ("lat" in parsed.data && "lon" in parsed.data) {
      const city =
        parsed.data.city ??
        (await reverseGeocodeCoords(parsed.data.lat, parsed.data.lon))?.name ??
        null;
      payload = {
        lat: parsed.data.lat,
        lon: parsed.data.lon,
        city,
        timezone: parsed.data.timezone ?? null,
      };
    } else {
      const geocoded = await geocodeCity(parsed.data.city);
      if (!geocoded) {
        res.status(404).json({ error: "city_not_found" });
        return;
      }
      payload = {
        lat: geocoded.lat,
        lon: geocoded.lon,
        city: geocoded.name,
        timezone: geocoded.timezone,
      };
    }

    if (isDemoUser(userId)) {
      demoLocation[userId] = payload;
      res.json(payload);
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: payload,
      select: { lat: true, lon: true, city: true, timezone: true },
    });
    res.json(user);
  } catch (err) {
    console.error("Location update error:", err);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// PATCH /api/profile — Update user profile fields
profileRouter.patch("/", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const parsed = ProfilePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { genderMode, name } = parsed.data;

    if (isDemoUser(userId)) {
      res.json({ ...DEMO_USER, ...(genderMode !== undefined ? { genderMode } : {}), ...(name !== undefined ? { name } : {}) });
      return;
    }

    const data: Record<string, unknown> = {};
    if (genderMode !== undefined) data.genderMode = genderMode;
    if (name !== undefined) data.name = name;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        genderMode: true,
        colorSeason: true,
        colorPalette: true,
        avoidColors: true,
      },
    });

    res.json(user);
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /api/profile/color-analysis — Analyze selfie for color type
profileRouter.post(
  "/color-analysis",
  requirePaidOrTrial,
  geminiLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const parsed = ColorAnalysisBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_payload" });
        return;
      }

      const result: ColorAnalysisResult = await analyzeColorType(parsed.data.image);

      if (isDemoUser(userId)) {
        res.json(result);
        return;
      }

      // Save to user profile — serialize through JSON to satisfy Prisma's InputJsonValue
      await prisma.user.update({
        where: { id: userId },
        data: {
          colorSeason: result.season,
          colorPalette: JSON.parse(JSON.stringify(result.palette)),
          avoidColors: JSON.parse(JSON.stringify(result.avoid)),
        },
      });

      res.json(result);
    } catch (err) {
      // Never forward raw upstream error text to the client — Gemini errors
      // can contain request internals. Map the two states the UI can act on.
      console.error("Color analysis error:", err);
      const message = err instanceof Error ? err.message : "";
      if (message.includes("not configured")) {
        res.status(503).json({ error: "color_analysis_not_configured" });
        return;
      }
      if (message.includes("timed out")) {
        res.status(504).json({ error: "color_analysis_timeout" });
        return;
      }
      res.status(500).json({ error: "color_analysis_failed" });
    }
  },
);

profileRouter.delete("/account", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    if (isDemoUser(userId)) {
      res.status(403).json({ error: "demo_account_cannot_be_deleted" });
      return;
    }

    const [items, ownerMemberships] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { userId },
        select: { imageUrl: true },
      }),
      prisma.familyMember.findMany({
        where: { userId, role: "owner" },
        select: { familyId: true },
      }),
    ]);

    await prisma.$transaction([
      prisma.family.deleteMany({
        where: { id: { in: ownerMemberships.map(({ familyId }) => familyId) } },
      }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await Promise.allSettled(items.map(({ imageUrl }) => deleteImage(imageUrl)));
    res.json({ ok: true });
  } catch (error) {
    console.error("Account delete error:", error);
    res.status(500).json({ error: "account_delete_failed" });
  }
});
