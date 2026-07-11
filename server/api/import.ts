import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import {
  analyzeClothingImage,
  FALLBACK_CLOTHING_ANALYSIS,
  reviewClothingAnalysis,
  type ClothingAnalysis,
} from "../services/gemini.js";
import { deleteImage, uploadImage } from "../services/cloudinary.js";
import { resolveTargetUser, wardrobeVisibilityWhere } from "../services/family.js";
import {
  addDemoWardrobeItems,
  deleteDemoWardrobeItem,
  getDemoWardrobe,
  isDemoUser,
  updateDemoWardrobeItem,
} from "../services/demo-store.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { requirePaidOrTrial } from "../middleware/require-access.js";

const geminiLimiter = rateLimitPerUser({ tag: "gemini" });
import { normalizeCategory } from "../../src/shared/wardrobe-categories.js";
import { withTimeout } from "../services/gemini-utils.js";
import { fetchBufferWithTimeout, fetchWithTimeout } from "../services/http.js";
import { ImageAnalyzeBodySchema } from "../services/request-schemas.js";
import { WARDROBE_SEASONS } from "../../src/shared/wardrobe-seasons.js";

/** Drive files larger than this are rejected instead of buffered into RAM. */
const DRIVE_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const DRIVE_FETCH_TIMEOUT_MS = 20_000;
const ANALYSIS_VERSION = "clothing-v2";
const METADATA_REVIEW_FIELDS = new Set([
  "category",
  "subcategory",
  "colorPrimary",
  "colorHex",
  "pattern",
  "fabric",
  "formalityLevel",
  "season",
  "brand",
]);

type ReviewTags = {
  analysisReliable?: boolean;
  needsReview?: boolean;
  reviewReasons?: string[];
  reviewSeverity?: "ok" | "suggestion" | "critical";
  analysisStatus?: "ok" | "partial" | "failed";
  analysisVersion?: string;
  humanReviewed?: boolean;
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function reviewTagsFor(
  analysis: ClothingAnalysis,
  analysisAvailable: boolean,
): ReviewTags {
  const reviewReasons = uniqueStrings([
    ...(analysisAvailable ? [] : ["analysis_unavailable"]),
    ...analysis.reviewReasons,
  ]);
  const needsReview = !analysisAvailable || analysis.needsReview || reviewReasons.length > 0;
  return {
    analysisReliable: analysisAvailable && !needsReview,
    needsReview,
    reviewReasons,
    reviewSeverity: analysis.reviewSeverity ?? (analysisAvailable ? "ok" : "critical"),
    analysisStatus: analysisAvailable ? analysis.analysisStatus ?? (needsReview ? "partial" : "ok") : "failed",
    analysisVersion: ANALYSIS_VERSION,
  };
}

function tagsRecord(tags: unknown): ReviewTags {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return tags as ReviewTags;
}

function decorateWardrobeItem<T extends { category: string; confidence: number; tags: unknown }>(
  item: T,
) {
  const tags = tagsRecord(item.tags);
  const reviewReasons = uniqueStrings([
    ...(Array.isArray(tags.reviewReasons) ? tags.reviewReasons : []),
    ...(item.confidence < 0.5 && tags.humanReviewed !== true ? ["low_confidence"] : []),
  ]);
  const needsReview = tags.needsReview === true || reviewReasons.length > 0;
  return {
    ...item,
    category: normalizeCategory(item.category),
    needsReview,
    reviewReasons,
    reviewSeverity: tags.reviewSeverity ?? (needsReview ? "suggestion" : "ok"),
    analysisStatus: tags.analysisStatus ?? (needsReview ? "partial" : "ok"),
    analysisReliable: tags.analysisReliable === true && !needsReview,
  };
}

export function clothingAnalysisFromItem(
  item: Partial<ClothingAnalysis> & { category: string; colorPrimary: string },
): ClothingAnalysis {
  return {
    ...FALLBACK_CLOTHING_ANALYSIS,
    ...item,
    category: normalizeCategory(item.category),
    subcategory: item.subcategory ?? FALLBACK_CLOTHING_ANALYSIS.subcategory,
    colorPrimary: item.colorPrimary,
    colorHex: item.colorHex ?? FALLBACK_CLOTHING_ANALYSIS.colorHex,
    pattern: item.pattern ?? FALLBACK_CLOTHING_ANALYSIS.pattern,
    fabric: item.fabric ?? FALLBACK_CLOTHING_ANALYSIS.fabric,
    formalityLevel: item.formalityLevel ?? FALLBACK_CLOTHING_ANALYSIS.formalityLevel,
    season: item.season ?? FALLBACK_CLOTHING_ANALYSIS.season,
    brand: item.brand ?? FALLBACK_CLOTHING_ANALYSIS.brand,
    confidence: item.confidence ?? FALLBACK_CLOTHING_ANALYSIS.confidence,
    needsReview: item.needsReview ?? false,
    reviewReasons: item.reviewReasons ?? [],
    // Never inherit the fallback's "failed"/"critical" status — this function
    // reconstructs an analysis from stored/edited fields, and the caller
    // (reviewClothingAnalysis) recomputes review flags from the actual reasons.
    // Leaking the fallback status made every manual save read as "Не розпізнано".
    analysisStatus: item.analysisStatus ?? ((item.needsReview ?? false) ? "partial" : "ok"),
    reviewSeverity: item.reviewSeverity ?? "ok",
  };
}

const SaveItemsSchema = z.object({
  items: z
    .array(
      z.object({
        imageUrl: z.string().min(1).max(2_000_000),
        thumbnailUrl: z.string().max(2_000_000).optional(),
        category: z.string().max(40),
        subcategory: z.string().max(80).optional(),
        colorPrimary: z.string().max(40),
        colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        pattern: z.string().max(40).optional(),
        fabric: z.string().max(40).optional(),
        formalityLevel: z.coerce.number().int().min(1).max(5).optional(),
        season: z.enum(WARDROBE_SEASONS).optional(),
        brand: z.string().max(80).optional(),
        confidence: z.coerce.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(100),
});

const DriveDownloadSchema = z.object({
  fileId: z.string().min(1).max(128).regex(/^[\w-]+$/),
});

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
    season: z.enum(WARDROBE_SEASONS).optional(),
    brand: z.string().max(80).nullable().optional(),
    sharedWithFamily: z.boolean().optional(),
  })
  .strict();

// POST /api/import/ingest — Direct-ingestion endpoint.
// Uploads -> analyzes with Gemini -> commits to wardrobe in ONE round-trip.
// This is the production path; /analyze + /save below are deprecated shims
// kept for older clients still in the wild.
importRouter.post("/ingest", requirePaidOrTrial, geminiLimiter, async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const parsedBody = ImageAnalyzeBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { image, mimeType, fileName } = parsedBody.data;

    const userId = req.userId!;

    // 1. Upload (Cloudinary or data-URL mock fallback)
    const tUpload0 = Date.now();
    const { imageUrl, thumbnailUrl } = await uploadImage(image, mimeType);
    const uploadMs = Date.now() - tUpload0;

    // 2. Analyze (Gemini with honest failure state; never invent fake black/tops data)
    const tGemini0 = Date.now();
    let tags;
    let analysisReliable = true;
    try {
      tags = await analyzeClothingImage(image, mimeType);
    } catch (err) {
      console.error("[ingest] Gemini analysis failed:", err);
      analysisReliable = false;
      tags = FALLBACK_CLOTHING_ANALYSIS;
    }
    const geminiMs = Date.now() - tGemini0;

    const normalizedTags = reviewClothingAnalysis({
      ...tags,
      category: normalizeCategory(tags.category),
    }).item;
    const reviewTags = reviewTagsFor(normalizedTags, analysisReliable);

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
          tags: reviewTags,
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
            tags: reviewTags,
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
      analysisReliable: reviewTags.analysisReliable === true,
      needsReview: reviewTags.needsReview === true,
      reviewReasons: reviewTags.reviewReasons ?? [],
      reviewSeverity: reviewTags.reviewSeverity ?? "ok",
      analysisStatus: reviewTags.analysisStatus ?? "ok",
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
importRouter.post("/analyze", requirePaidOrTrial, geminiLimiter, async (req: Request, res: Response) => {
  try {
    const parsedBody = ImageAnalyzeBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { image, mimeType, fileName } = parsedBody.data;

    const { imageUrl, thumbnailUrl } = await uploadImage(image, mimeType);

    let tags;
    let analysisReliable = true;
    try {
      tags = await analyzeClothingImage(image, mimeType);
    } catch (err) {
      console.error("Gemini analysis failed:", err);
      analysisReliable = false;
      tags = FALLBACK_CLOTHING_ANALYSIS;
    }
    const normalizedTags = reviewClothingAnalysis({
      ...tags,
      category: normalizeCategory(tags.category),
    }).item;
    const reviewTags = reviewTagsFor(normalizedTags, analysisReliable);

    res.setHeader("Deprecation", "true");
    res.setHeader("Link", '</api/import/ingest>; rel="successor-version"');
    res.json({
      imageUrl,
      thumbnailUrl,
      tags: normalizedTags,
      analysisReliable: reviewTags.analysisReliable === true,
      needsReview: reviewTags.needsReview === true,
      reviewReasons: reviewTags.reviewReasons ?? [],
      reviewSeverity: reviewTags.reviewSeverity ?? "ok",
      analysisStatus: reviewTags.analysisStatus ?? "ok",
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
    const parsedBody = SaveItemsSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { items } = parsedBody.data;

    const userId = req.userId!;
    const reviewedItems = items.map((item) => {
      const reviewed = reviewClothingAnalysis(clothingAnalysisFromItem({
        ...item,
        category: normalizeCategory(item.category),
        colorPrimary: item.colorPrimary,
      })).item;
      return { item: reviewed, reviewTags: reviewTagsFor(reviewed, true), imageUrl: item.imageUrl, thumbnailUrl: item.thumbnailUrl };
    });

    if (isDemoUser(userId)) {
      const saved = addDemoWardrobeItems(
        userId,
        reviewedItems.map(({ item, imageUrl, thumbnailUrl, reviewTags }) => ({
          ...item,
          imageUrl,
          thumbnailUrl,
          tags: reviewTags,
        })),
      );
      res.json({ saved });
      return;
    }


    const created = await prisma.wardrobeItem.createMany({
      data: reviewedItems.map(({ item, imageUrl, thumbnailUrl, reviewTags }) => ({
        userId,
        imageUrl,
        thumbnailUrl,
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
        tags: reviewTags,
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
      res.json(getDemoWardrobe(userId).map(decorateWardrobeItem));
      return;
    }

    const memberId = req.query.memberId as string | undefined;
    const { targetUserId, error } = await resolveTargetUser(userId, memberId);
    if (error) {
      res.status(403).json({ error });
      return;
    }

    const rawItems = await prisma.wardrobeItem.findMany({
      where: wardrobeVisibilityWhere(userId, targetUserId),
      orderBy: { createdAt: "desc" },
    });
    // Normalize legacy category strings ("shoes" -> "footwear" etc.) at read
    // time so the UI never sees deprecated labels even before rows are edited.
    const items = rawItems.map(decorateWardrobeItem);
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

    const driveRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      { headers: { Authorization: `Bearer ${user.googleAccessToken}` } },
      DRIVE_FETCH_TIMEOUT_MS,
    );

    if (driveRes.status === 401) {
      res.status(401).json({ error: "drive_access_expired" });
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
    const parsedBody = DriveDownloadSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { fileId } = parsedBody.data;

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

    // Get file metadata — size first so we never buffer a 2 GB video into RAM.
    const metaRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
      { headers: { Authorization: `Bearer ${user.googleAccessToken}` } },
      DRIVE_FETCH_TIMEOUT_MS,
    );
    if (!metaRes.ok) {
      if (metaRes.status === 401 || metaRes.status === 403) {
        res.status(401).json({ error: "drive_access_expired" });
        return;
      }
      res.status(502).json({ error: "Failed to get file metadata from Drive" });
      return;
    }
    const meta = (await metaRes.json()) as { name: string; mimeType: string; size?: string };

    if (!meta.mimeType?.startsWith("image/")) {
      res.status(400).json({ error: "not_an_image" });
      return;
    }
    const declaredSize = Number(meta.size ?? 0);
    if (declaredSize > DRIVE_MAX_FILE_BYTES) {
      res.status(413).json({ error: "file_too_large" });
      return;
    }

    // Download file content
    let contentRes: globalThis.Response;
    let buffer: Buffer;
    try {
      const downloaded = await fetchBufferWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${user.googleAccessToken}` } },
        DRIVE_FETCH_TIMEOUT_MS,
        DRIVE_MAX_FILE_BYTES,
      );
      contentRes = downloaded.response;
      buffer = downloaded.buffer;
    } catch (error) {
      if (error instanceof Error && error.message === "response_body_too_large") {
        res.status(413).json({ error: "file_too_large" });
        return;
      }
      throw error;
    }
    if (!contentRes.ok) {
      if (contentRes.status === 401 || contentRes.status === 403) {
        res.status(401).json({ error: "drive_access_expired" });
        return;
      }
      res.status(502).json({ error: "Failed to download file from Drive" });
      return;
    }

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
    const metadataChanged = Object.keys(patch).some((key) => METADATA_REVIEW_FIELDS.has(key));

    if (isDemoUser(userId)) {
      const updated = updateDemoWardrobeItem(userId, itemId, {
        ...patch,
        ...(metadataChanged ? { tags: { humanReviewed: true, needsReview: false } } : {}),
      });
      if (!updated) {
        res.status(404).json({ error: "Item not found" });
        return;
      }
      res.json({ item: decorateWardrobeItem(updated) });
      return;
    }

    const existing = await prisma.wardrobeItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const reviewData = metadataChanged
      ? (() => {
          const merged = clothingAnalysisFromItem({
            category: patch.category ?? existing.category,
            subcategory: patch.subcategory === undefined ? existing.subcategory ?? undefined : patch.subcategory ?? undefined,
            colorPrimary: patch.colorPrimary ?? existing.colorPrimary,
            colorHex: patch.colorHex === undefined ? existing.colorHex ?? undefined : patch.colorHex ?? undefined,
            pattern: patch.pattern ?? existing.pattern,
            fabric: patch.fabric === undefined ? existing.fabric ?? undefined : patch.fabric ?? undefined,
            formalityLevel: patch.formalityLevel ?? existing.formalityLevel,
            season: patch.season ?? existing.season,
            brand: patch.brand === undefined ? existing.brand : patch.brand,
            confidence: existing.confidence,
            needsReview: false,
            reviewReasons: [],
          });
          const reviewed = reviewClothingAnalysis(merged, { trustManualReview: true }).item;
          return {
            category: reviewed.category,
            season: reviewed.season,
            confidence: reviewed.confidence,
            tags: {
              ...reviewTagsFor(reviewed, true),
              humanReviewed: true,
            },
          };
        })()
      : {};

    const item = await withTimeout(
      prisma.wardrobeItem.update({
        where: { id: itemId },
        data: { ...patch, ...reviewData },
      }),
      5_000,
      "Database update timed out",
    );

    res.json({ item: decorateWardrobeItem(item) });
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
    await deleteImage(item.imageUrl);
    res.json({ ok: true });
  } catch (err) {
    console.error("Wardrobe delete error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// POST /api/import/wardrobe/:itemId/reanalyze — Re-run AI on the stored photo.
// Recovers items that were saved with fallback tags (e.g. during a Gemini
// rate-limit spell) without forcing the user to delete and re-upload.
importRouter.post(
  "/wardrobe/:itemId/reanalyze",
  requirePaidOrTrial,
  geminiLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const itemId = Array.isArray(req.params.itemId)
        ? req.params.itemId[0]
        : req.params.itemId ?? "";

      // Demo items are seeded placeholders with no real photo to analyse.
      if (isDemoUser(userId)) {
        res.status(400).json({ error: "reanalyze_unavailable_demo" });
        return;
      }

      const existing = await prisma.wardrobeItem.findUnique({ where: { id: itemId } });
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      // Pull the stored (original) photo back from Cloudinary as base64.
      let base64: string;
      let mimeType = "image/jpeg";
      try {
        const downloaded = await fetchBufferWithTimeout(existing.imageUrl, {}, 15_000);
        if (!downloaded.response.ok || downloaded.buffer.length === 0) {
          res.status(502).json({ error: "image_fetch_failed" });
          return;
        }
        base64 = downloaded.buffer.toString("base64");
        mimeType = downloaded.response.headers.get("content-type") ?? "image/jpeg";
      } catch {
        res.status(502).json({ error: "image_fetch_failed" });
        return;
      }

      let tags;
      try {
        tags = await analyzeClothingImage(base64, mimeType);
      } catch {
        res.status(503).json({ error: "reanalyze_failed" });
        return;
      }

      const reviewed = reviewClothingAnalysis({
        ...tags,
        category: normalizeCategory(tags.category),
      }).item;
      const reviewTags = reviewTagsFor(reviewed, reviewed.analysisStatus !== "failed");

      const item = await withTimeout(
        prisma.wardrobeItem.update({
          where: { id: itemId },
          data: {
            category: reviewed.category,
            subcategory: reviewed.subcategory,
            colorPrimary: reviewed.colorPrimary,
            colorHex: reviewed.colorHex,
            pattern: reviewed.pattern,
            fabric: reviewed.fabric,
            formalityLevel: reviewed.formalityLevel,
            season: reviewed.season,
            confidence: reviewed.confidence,
            tags: reviewTags,
          },
        }),
        5_000,
        "Database update timed out",
      );

      res.json({ item: decorateWardrobeItem(item) });
    } catch (err) {
      console.error("Wardrobe reanalyze error:", err);
      res.status(500).json({ error: "reanalyze_failed" });
    }
  },
);
