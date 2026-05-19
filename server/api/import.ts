import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { analyzeClothingImage, FALLBACK_CLOTHING_ANALYSIS } from "../services/gemini.js";
import { uploadImage } from "../services/cloudinary.js";
import { resolveTargetUser } from "../services/family.js";
import {
  addDemoWardrobeItems,
  deleteDemoWardrobeItem,
  getDemoWardrobe,
  isDemoUser,
  updateDemoWardrobeItem,
} from "../services/demo-store.js";
import { normalizeCategory } from "../../src/shared/wardrobe-categories.js";
import { withTimeout } from "../services/gemini-utils.js";

export const importRouter = Router();

// Zod schema for the per-item edit endpoint (PATCH /wardrobe/:itemId).
// All fields are optional — caller sends only what they want to change.
const ItemPatchSchema = z
  .object({
    category: z
      .string()
      .transform((v) => normalizeCategory(v))
      .optional(),
    subcategory: z.string().max(80).nullable().optional(),
    colorPrimary: z.string().max(40).optional(),
    colorHex: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .nullable()
      .optional(),
    pattern: z.string().max(40).optional(),
    fabric: z.string().max(40).nullable().optional(),
    formalityLevel: z.number().int().min(1).max(5).optional(),
    season: z.enum(["spring", "summer", "fall", "winter", "all"]).optional(),
    brand: z.string().max(80).nullable().optional(),
  })
  .strict();

// POST /api/import/ingest — Direct-ingestion endpoint.
// Uploads -> analyzes with Gemini -> commits to wardrobe in ONE round-trip.
// This is the production path; /analyze + /save below are deprecated shims
// kept for older clients still in the wild.
importRouter.post("/ingest", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { image, mimeType, fileName } = req.body as {
      image?: string;
      mimeType?: string;
      fileName?: string;
    };

    if (!image || !mimeType) {
      res.status(400).json({ error: "image and mimeType are required" });
      return;
    }

    const userId = req.userId!;

    // 1. Upload (Cloudinary or data-URL mock fallback)
    const tUpload0 = Date.now();
    const { imageUrl, thumbnailUrl } = await uploadImage(image, mimeType);
    const uploadMs = Date.now() - tUpload0;

    // 2. Analyze (Gemini with safe fallback)
    const tGemini0 = Date.now();
    let tags;
    try {
      tags = await analyzeClothingImage(image, mimeType);
    } catch (err) {
      console.error("[ingest] Gemini analysis failed, using fallback:", err);
      tags = FALLBACK_CLOTHING_ANALYSIS;
    }
    const geminiMs = Date.now() - tGemini0;

    const normalizedTags = { ...tags, category: normalizeCategory(tags.category) };

    // 3. Persist immediately — no manual confirmation step
    let savedId: string;
    let createdAt: Date;
    const tDb0 = Date.now();
    if (isDemoUser(userId)) {
      addDemoWardrobeItems(userId, [
        {
          imageUrl,
          thumbnailUrl,
          category: normalizedTags.category,
          subcategory: normalizedTags.subcategory,
          colorPrimary: normalizedTags.colorPrimary,
          colorHex: normalizedTags.colorHex,
          pattern: normalizedTags.pattern,
          fabric: normalizedTags.fabric,
          formalityLevel: normalizedTags.formalityLevel,
          season: normalizedTags.season,
          brand: normalizedTags.brand ?? undefined,
          confidence: normalizedTags.confidence,
        },
      ]);
      // demo store returns count only — fetch the most recent item id from the head
      const all = getDemoWardrobe(userId);
      savedId = all[0]?.id ?? "demo-unknown";
      createdAt = all[0]?.createdAt ?? new Date();
    } else {
      const item = await withTimeout(
        prisma.wardrobeItem.create({
          data: {
            userId,
            imageUrl,
            thumbnailUrl,
            category: normalizedTags.category,
            subcategory: normalizedTags.subcategory ?? null,
            colorPrimary: normalizedTags.colorPrimary,
            colorHex: normalizedTags.colorHex ?? null,
            pattern: normalizedTags.pattern ?? "solid",
            fabric: normalizedTags.fabric ?? null,
            formalityLevel: normalizedTags.formalityLevel ?? 3,
            season: normalizedTags.season ?? "all",
            brand: normalizedTags.brand ?? null,
            confidence: normalizedTags.confidence ?? 0,
          },
        }),
        7_000,
        "Database create timed out",
      );
      savedId = item.id;
      createdAt = item.createdAt;
    }
    const dbMs = Date.now() - tDb0;
    const totalMs = Date.now() - t0;

    if (process.env.DEBUG_UPLOAD === "1") {
      console.log(
        `[ingest] file=${fileName ?? "?"} upload=${uploadMs}ms gemini=${geminiMs}ms db=${dbMs}ms total=${totalMs}ms`,
      );
    }

    res.json({
      id: savedId,
      imageUrl,
      thumbnailUrl,
      tags: normalizedTags,
      fileName,
      createdAt,
      timings: { uploadMs, geminiMs, dbMs, totalMs },
    });
  } catch (err) {
    console.error("[ingest] error:", err);
    res.status(500).json({ error: "ingest_failed" });
  }
});

// POST /api/import/analyze — DEPRECATED: kept for old clients.
// New code paths use /ingest. This shim returns the analyze-only response
// (no DB commit) and signals deprecation via header.
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

    const { imageUrl, thumbnailUrl } = await uploadImage(image, mimeType);

    let tags;
    try {
      tags = await analyzeClothingImage(image, mimeType);
    } catch (err) {
      console.error("Gemini analysis failed:", err);
      tags = FALLBACK_CLOTHING_ANALYSIS;
    }

    res.setHeader("Deprecation", "true");
    res.setHeader("Link", '</api/import/ingest>; rel="successor-version"');
    res.json({
      imageUrl,
      thumbnailUrl,
      tags: { ...tags, category: normalizeCategory(tags.category) },
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

    const userId = req.userId!;
    if (isDemoUser(userId)) {
      const saved = addDemoWardrobeItems(userId, items);
      res.json({ saved });
      return;
    }


    const created = await prisma.wardrobeItem.createMany({
      data: items.map((item) => ({
        userId,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        category: normalizeCategory(item.category),
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

// GET /api/import/wardrobe — Get all wardrobe items (supports ?memberId= for family)
importRouter.get("/wardrobe", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    if (isDemoUser(userId)) {
      res.json(getDemoWardrobe(userId));
      return;
    }

    const memberId = req.query.memberId as string | undefined;
    const { targetUserId, error } = await resolveTargetUser(userId, memberId);
    if (error) {
      res.status(403).json({ error });
      return;
    }

    const rawItems = await prisma.wardrobeItem.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
    });
    // Normalize legacy category strings ("shoes" -> "footwear" etc.) at read
    // time so the UI never sees deprecated labels even before rows are edited.
    const items = rawItems.map((item) => ({
      ...item,
      category: normalizeCategory(item.category),
    }));
    res.json(items);
  } catch (err) {
    console.error("Wardrobe fetch error:", err);
    res.status(500).json({ error: "Failed to fetch wardrobe" });
  }
});

// GET /api/import/drive/list — List image files from user's Google Drive (no Picker API key needed)
importRouter.get("/drive/list", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    if (isDemoUser(userId)) {
      res.status(401).json({ error: "Google Drive listing requires Google login." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleAccessToken: true },
    });
    if (!user?.googleAccessToken) {
      res.status(401).json({ error: "No Google access token. Re-login via Google to grant Drive access." });
      return;
    }

    const folderId = typeof req.query.folderId === "string" ? req.query.folderId : "";
    const pageToken = typeof req.query.pageToken === "string" ? req.query.pageToken : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const conditions: string[] = ["trashed = false"];
    if (folderId) conditions.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
    conditions.push("(mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder')");
    if (search) conditions.push(`name contains '${search.replace(/'/g, "\\'")}'`);

    const params = new URLSearchParams({
      q: conditions.join(" and "),
      fields: "nextPageToken, files(id, name, mimeType, iconLink, thumbnailLink, modifiedTime, parents)",
      pageSize: "100",
      orderBy: "folder,modifiedTime desc",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${user.googleAccessToken}` },
    });

    if (driveRes.status === 401) {
      res.status(401).json({ error: "Google access token expired. Re-login via Google." });
      return;
    }
    if (!driveRes.ok) {
      const body = await driveRes.text();
      console.error("Drive list error:", body);
      res.status(502).json({ error: "Failed to list Drive files" });
      return;
    }

    const data = (await driveRes.json()) as {
      nextPageToken?: string;
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        iconLink?: string;
        thumbnailLink?: string;
        modifiedTime?: string;
        parents?: string[];
      }>;
    };

    res.json({
      files: data.files ?? [],
      nextPageToken: data.nextPageToken ?? null,
    });
  } catch (err) {
    console.error("[DRIVE] list error:", err);
    res.status(500).json({ error: "Failed to list Drive files" });
  }
});

// POST /api/import/drive-download — Download image from Google Drive
importRouter.post("/drive-download", async (req: Request, res: Response) => {
  try {
    const { fileId } = req.body as { fileId: string };
    if (!fileId) {
      res.status(400).json({ error: "fileId is required" });
      return;
    }

    const userId = req.userId!;
    if (isDemoUser(userId)) {
      res.status(401).json({ error: "Google Drive import requires Google login." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleAccessToken: true },
    });

    if (!user?.googleAccessToken) {
      res.status(401).json({ error: "No Google access token" });
      return;
    }

    // Get file metadata
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${user.googleAccessToken}` } },
    );
    if (!metaRes.ok) {
      res.status(502).json({ error: "Failed to get file metadata from Drive" });
      return;
    }
    const meta = (await metaRes.json()) as { name: string; mimeType: string };

    // Download file content
    const contentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${user.googleAccessToken}` } },
    );
    if (!contentRes.ok) {
      res.status(502).json({ error: "Failed to download file from Drive" });
      return;
    }

    const buffer = Buffer.from(await contentRes.arrayBuffer());
    const base64 = buffer.toString("base64");

    res.json({
      base64,
      mimeType: meta.mimeType ?? "image/jpeg",
      fileName: meta.name ?? `drive_${fileId}`,
    });
  } catch (err) {
    console.error("[DRIVE] download error:", err);
    res.status(500).json({ error: "Failed to download from Google Drive" });
  }
});

// PATCH /api/import/wardrobe/:itemId — Edit category / tags of an existing item
importRouter.patch("/wardrobe/:itemId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const itemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId ?? "";

    const parsed = ItemPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", issues: parsed.error.flatten() });
      return;
    }
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "empty_payload" });
      return;
    }

    if (isDemoUser(userId)) {
      const updated = updateDemoWardrobeItem(userId, itemId, patch);
      if (!updated) {
        res.status(404).json({ error: "Item not found" });
        return;
      }
      res.json({ item: updated });
      return;
    }

    const existing = await prisma.wardrobeItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const item = await withTimeout(
      prisma.wardrobeItem.update({
        where: { id: itemId },
        data: patch,
      }),
      5_000,
      "Database update timed out",
    );

    res.json({ item });
  } catch (err) {
    console.error("Wardrobe patch error:", err);
    res.status(500).json({ error: "patch_failed" });
  }
});

// DELETE /api/import/wardrobe/:itemId — Delete a wardrobe item
importRouter.delete("/wardrobe/:itemId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const itemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId ?? "";

    if (isDemoUser(userId)) {
      if (!deleteDemoWardrobeItem(userId, itemId)) {
        res.status(404).json({ error: "Item not found" });
        return;
      }
      res.json({ ok: true });
      return;
    }

    const item = await prisma.wardrobeItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.userId !== userId) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    await prisma.wardrobeItem.delete({ where: { id: itemId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Wardrobe delete error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});
