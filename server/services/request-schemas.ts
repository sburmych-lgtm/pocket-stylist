import { z } from "zod";

/**
 * Shared request-body schemas for image-carrying AI endpoints
 * (import/ingest, import/analyze, scanner, matching, color-analysis).
 *
 * Body limit is 50 MB JSON; base64 of a ~10 MB photo is ~14M chars, so cap
 * image payloads at 15M chars — enough for any phone photo after the
 * client-side compression pass, small enough to reject absurd payloads.
 */
export const ImageBase64Schema = z.string().min(8).max(15_000_000);

export const ImageMimeTypeSchema = z
  .string()
  .max(64)
  .regex(/^image\/[a-z0-9.+-]+$/i, "must be an image/* mime type");

export const ImageAnalyzeBodySchema = z.object({
  image: ImageBase64Schema,
  mimeType: ImageMimeTypeSchema,
  fileName: z.string().max(255).optional(),
});
