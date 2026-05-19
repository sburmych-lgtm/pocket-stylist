/**
 * Image processing utilities for the upload pipeline.
 *
 * Two responsibilities:
 *  1. Convert iPhone .HEIC/.HEIF files into JPEG so <img>/canvas can read them.
 *     The heic2any module is heavy (~700KB), so it's lazy-loaded only when an
 *     actual HEIC file appears. This keeps the initial bundle lean.
 *  2. Compress + downscale any image to a sensible JPEG so we don't ship
 *     20-megapixel originals to Gemini / Cloudinary on every upload.
 */

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

function isHeicFile(file: File): boolean {
  if (HEIC_MIME_TYPES.has(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

/**
 * If the file is HEIC/HEIF, convert it to a JPEG File on the fly.
 * Otherwise returns the original file unchanged.
 *
 * Throws a user-friendly Error on conversion failure so callers can display
 * a clean toast instead of a generic stack trace.
 */
export async function ensureBrowserReadable(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  let heic2any: (opts: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;

  try {
    const mod = await import("heic2any");
    heic2any = mod.default ?? (mod as unknown as typeof heic2any);
  } catch (err) {
    console.error("[heic] failed to load heic2any:", err);
    throw new Error("HEIC_LOADER_UNAVAILABLE");
  }

  try {
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const newName = file.name.replace(/\.heic|\.heif/gi, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: file.lastModified });
  } catch (err) {
    console.error("[heic] conversion failed:", err);
    throw new Error("HEIC_CONVERSION_FAILED");
  }
}

/**
 * Compress an image file before upload.
 * Resizes to maxDimension and converts to JPEG with given quality.
 * Returns base64 string (without data URL prefix).
 *
 * Automatically handles HEIC inputs via ensureBrowserReadable.
 */
export async function compressImageToBase64(
  inputFile: File,
  maxDimension = 1600,
  quality = 0.8,
): Promise<string> {
  const t0 = performance.now();
  const file = await ensureBrowserReadable(inputFile);
  const heicMs = performance.now() - t0;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context not supported"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1];

      if (
        typeof window !== "undefined" &&
        window.localStorage?.getItem("DEBUG_UPLOAD") === "1"
      ) {
        const totalMs = performance.now() - t0;
        const bytes = Math.round((base64.length * 3) / 4);
        console.log(
          `[compress] ${file.name} heic=${heicMs.toFixed(0)}ms total=${totalMs.toFixed(0)}ms ` +
            `out=${(bytes / 1024).toFixed(0)}KB ${width}x${height}`,
        );
      }

      resolve(base64);
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = URL.createObjectURL(file);
  });
}
