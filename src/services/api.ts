const API_BASE = "/api";

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function analyzeImage(image: string, mimeType: string, fileName: string) {
  return apiFetch<{
    imageUrl: string;
    thumbnailUrl: string;
    tags: {
      category: string;
      subcategory: string;
      colorPrimary: string;
      colorHex: string;
      pattern: string;
      fabric: string;
      formalityLevel: number;
      season: string;
      brand: string | null;
      confidence: number;
    };
    fileName: string;
  }>("/import/analyze", {
    method: "POST",
    body: JSON.stringify({ image, mimeType, fileName }),
  });
}

export function saveItems(
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
  }>,
) {
  return apiFetch<{ saved: number }>("/import/save", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function fetchWardrobe() {
  return apiFetch<Array<Record<string, unknown>>>("/import/wardrobe");
}
