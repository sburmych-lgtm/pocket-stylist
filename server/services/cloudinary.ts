import { v2 as cloudinary } from "cloudinary";
import { isConfiguredSecret } from "./app-status.js";

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
    // Mock mode: store as data URL
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    return {
      imageUrl: dataUrl,
      thumbnailUrl: dataUrl,
    };
  }

  const result = await cloudinary.uploader.upload(
    `data:${mimeType};base64,${base64Data}`,
    {
      folder: "pocket-stylist",
      transformation: [{ width: 1200, height: 1600, crop: "limit" }],
    },
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

export { isConfigured as cloudinaryConfigured };
