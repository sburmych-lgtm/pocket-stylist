const CLOUDINARY_HOST = "res.cloudinary.com";

export function isCloudinaryImageUrl(imageUrl: string): boolean {
  try {
    return new URL(imageUrl).hostname === CLOUDINARY_HOST;
  } catch {
    return false;
  }
}

export function wardrobeCatalogImageUrl(imageUrl: string): string {
  if (!isCloudinaryImageUrl(imageUrl)) return imageUrl;

  try {
    const url = new URL(imageUrl);
    const uploadMarker = "/upload/";
    const uploadIndex = url.pathname.indexOf(uploadMarker);
    if (uploadIndex === -1) return imageUrl;

    const beforeUpload = url.pathname.slice(0, uploadIndex + uploadMarker.length);
    const afterUpload = url.pathname.slice(uploadIndex + uploadMarker.length);
    if (afterUpload.startsWith("e_background_removal")) return imageUrl;

    url.pathname = `${beforeUpload}e_background_removal,q_auto,f_auto/${afterUpload}`;
    return url.toString();
  } catch {
    return imageUrl;
  }
}
