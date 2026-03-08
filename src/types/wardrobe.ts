export interface WardrobeItemTag {
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
}

export interface ImportItem {
  id: string;
  fileName: string;
  previewUrl: string;
  status: "pending" | "uploading" | "analyzing" | "done" | "error";
  tags?: WardrobeItemTag;
  error?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface WardrobeItem {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  category: string;
  subcategory: string | null;
  colorPrimary: string;
  colorHex: string | null;
  pattern: string;
  fabric: string | null;
  formalityLevel: number;
  season: string;
  brand: string | null;
  confidence: number;
  timesWorn: number;
  lastWornAt: string | null;
  createdAt: string;
}
