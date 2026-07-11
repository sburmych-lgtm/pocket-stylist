import { wardrobeCatalogImageUrl } from "../../utils/cloudinaryImages";

interface CatalogImageProps {
  imageUrl: string;
  fallbackUrl?: string | null;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}

export function CatalogImage({
  imageUrl,
  fallbackUrl,
  alt,
  className = "h-full w-full bg-[#f7f2e8] object-contain p-2",
  loading = "lazy",
}: CatalogImageProps) {
  return (
    <img
      src={wardrobeCatalogImageUrl(imageUrl)}
      alt={alt}
      className={className}
      loading={loading}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = fallbackUrl ?? imageUrl;
      }}
    />
  );
}
