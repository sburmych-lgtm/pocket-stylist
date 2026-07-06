import { fal } from "@fal-ai/client";
import { z } from "zod";
import { isConfiguredSecret } from "../app-status.js";

/**
 * Fal cold-start queues can run 10–30 s; 60 s is the hard ceiling after
 * which we give the client a clean `tryon_timeout` (mapped to HTTP 504)
 * instead of pinning the request forever.
 */
const TRYON_TIMEOUT_MS = 60_000;

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!isConfiguredSecret(process.env.FAL_KEY)) return false;
  fal.config({ credentials: process.env.FAL_KEY });
  configured = true;
  return true;
}

const TryOnResponseSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url(),
        width: z.number().optional(),
        height: z.number().optional(),
        content_type: z.string().optional(),
      }),
    )
    .min(1),
});

export interface TryOnResult {
  imageUrl: string;
  durationMs: number;
}

/**
 * Calls a Fal.ai diffusion-style virtual try-on model with the user's
 * selfie + a garment photo and returns the generated composite image URL.
 *
 * Inputs may be either fully-qualified HTTP URLs (e.g. Cloudinary CDN
 * links) or `data:image/...;base64,...` strings — Fal accepts both.
 *
 * Throws `Error("tryon_not_configured")` if FAL_KEY is missing so the
 * caller can return a clean 503 to the client instead of leaking a
 * stack trace.
 */
export async function runTryOn(input: {
  modelImage: string;
  garmentImage: string;
  /** Fal endpoint id. Defaults to FASHN TryOn but is overridable. */
  endpoint?: string;
}): Promise<TryOnResult> {
  if (!ensureConfigured()) {
    throw new Error("tryon_not_configured");
  }

  const endpoint = input.endpoint ?? "fashn/tryon/v1.6";
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRYON_TIMEOUT_MS);
  let result: Awaited<ReturnType<typeof fal.subscribe>>;
  try {
    result = await fal.subscribe(endpoint, {
      input: {
        model_image: input.modelImage,
        garment_image: input.garmentImage,
      },
      logs: false,
      abortSignal: controller.signal,
      startTimeout: Math.ceil(TRYON_TIMEOUT_MS / 1000),
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("tryon_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const parsed = TryOnResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error("tryon_invalid_response");
  }

  return {
    imageUrl: parsed.data.images[0].url,
    durationMs: Date.now() - start,
  };
}
