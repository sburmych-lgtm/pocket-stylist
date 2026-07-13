import { v2 as cloudinary } from "cloudinary";
import { isConfiguredSecret } from "./app-status.js";
import { withTimeout } from "./gemini-utils.js";

/** Hard ceiling for a Cloudinary upload — a hung CDN must not stall /ingest. */
const UPLOAD_TIMEOUT_MS = 30_000;

const isConfigured =
  isConfiguredSecret(process.env.CLOUDINARY_CLOUD_NAME) &&
  isConfiguredSecret(process.env.CLOUDINARY_API_KEY) &&
  isConfiguredSecret(process.env.CLOUDINARY_API_SECRET);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export interface UploadResult {
  imageUrl: string;
  thumbnailUrl: string;
}

export async function uploadImage(
  base64Data: string,
  mimeType: string,
): Promise<UploadResult> {
  if (!isConfigured) {
    // In PRODUCTION a missing Cloudinary config must fail loudly. Silently
    // storing the raw image as a base64 data URL bloats every row and makes
    // the wardrobe endpoint return hundreds of MB of JSON — unloadable on a
    // phone (this is exactly what corrupted an early bulk import). Only fall
    // back to an inline data URL in local dev / mock mode.
    if (process.env.NODE_ENV === "production") {
      throw new Error("cloudinary_not_configured");
    }
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    return {
      imageUrl: dataUrl,
      thumbnailUrl: dataUrl,
    };
  }

  const result = await withTimeout(
    cloudinary.uploader.upload(`data:${mimeType};base64,${base64Data}`, {
      folder: "pocket-stylist",
      transformation: [{ width: 1200, height: 1600, crop: "limit" }],
      timeout: UPLOAD_TIMEOUT_MS,
    }),
    UPLOAD_TIMEOUT_MS + 5_000,
    "cloudinary_upload_timed_out",
  );

  const thumbnailUrl = cloudinary.url(result.public_id, {
    transformation: [
      { width: 300, height: 400, crop: "fill", gravity: "auto" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });

  return {
    imageUrl: result.secure_url,
    thumbnailUrl,
  };
}

function publicIdFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    if (url.hostname !== "res.cloudinary.com") return null;
    const marker = "/upload/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const afterUpload = url.pathname.slice(markerIndex + marker.length);
    const withoutVersion = afterUpload.replace(/^v\d+\//, "");
    return decodeURIComponent(withoutVersion.replace(/\.[a-z0-9]+$/i, ""));
  } catch {
    return null;
  }
}

export async function deleteImage(imageUrl: string): Promise<boolean> {
  if (!isConfigured) return false;
  const publicId = publicIdFromUrl(imageUrl);
  if (!publicId) return false;
  try {
    await withTimeout(
      cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      }),
      15_000,
      "cloudinary_delete_timed_out",
    );
    return true;
  } catch (error) {
    console.warn("[cloudinary] image cleanup failed", {
      publicId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

export { isConfigured as cloudinaryConfigured };
