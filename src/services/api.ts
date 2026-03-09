const API_BASE = "/api";

const TOKEN_KEY = "pocket_stylist_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/* ---------- Auth types ---------- */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  genderMode: string;
  colorSeason: string | null;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

/* ---------- Auth API ---------- */

export const authApi = {
  loginGoogle(credential: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
  },

  loginDemo(): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/demo", {
      method: "POST",
    });
  },

  async getMe(): Promise<AuthUser> {
    const res = await apiFetch<{ user: AuthUser }>("/auth/me");
    return res.user;
  },
};

/* ---------- Existing domain API ---------- */

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

/* ---------- App Status ---------- */

export interface AppStatus {
  version: string;
  geminiConfigured: boolean;
  cloudinaryConfigured: boolean;
  weatherConfigured: boolean;
  googleAuthConfigured: boolean;
  googleClientId: string | null;
}

let _statusCache: AppStatus | null = null;

export async function getAppStatus(): Promise<AppStatus> {
  if (_statusCache) return _statusCache;
  const res = await fetch("/api/status");
  _statusCache = (await res.json()) as AppStatus;
  return _statusCache;
}

/* ---------- Profile types ---------- */

export interface ColorPaletteEntry {
  name: string;
  hex: string;
}

export interface ColorAnalysisResult {
  season: string;
  undertone: string;
  contrast: string;
  palette: ColorPaletteEntry[];
  avoid: ColorPaletteEntry[];
  description: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  genderMode: string;
  colorSeason: string | null;
  colorPalette: ColorPaletteEntry[] | null;
  avoidColors: ColorPaletteEntry[] | null;
}

/* ---------- Profile API ---------- */

export const profileApi = {
  getProfile(): Promise<UserProfile> {
    return apiFetch<UserProfile>("/profile");
  },

  updateProfile(data: { genderMode?: string; name?: string }): Promise<UserProfile> {
    return apiFetch<UserProfile>("/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  analyzeColor(image: string): Promise<ColorAnalysisResult> {
    return apiFetch<ColorAnalysisResult>("/profile/color-analysis", {
      method: "POST",
      body: JSON.stringify({ image }),
    });
  },
};

/* ---------- Lookbook types ---------- */

export interface LookbookDayWeather {
  temp: number;
  feelsLike: number;
  condition: string;
  icon: string;
  location: string;
}

export interface LookbookOutfit {
  name: string;
  items: Array<{
    id: string;
    imageUrl: string;
    thumbnailUrl: string | null;
    category: string;
    subcategory: string | null;
    colorPrimary: string;
  }>;
  stylingTip: string;
  confidence: number;
}

export interface LookbookDay {
  date: string;
  weather: LookbookDayWeather;
  outfit: LookbookOutfit | null;
}

export interface LookbookResponse {
  days: LookbookDay[];
  weekStart: string;
  message?: string;
}

/* ---------- Lookbook API ---------- */

export const lookbookApi = {
  generate(lat?: number, lon?: number, memberId?: string): Promise<LookbookResponse> {
    return apiFetch<LookbookResponse>("/lookbook/generate", {
      method: "POST",
      body: JSON.stringify({ lat, lon, memberId }),
    });
  },

  getCurrent(): Promise<{ days: LookbookDay[] | null }> {
    return apiFetch<{ days: LookbookDay[] | null }>("/lookbook/current");
  },

  logWear(dayIndex: number, itemIds: string[]): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/lookbook/${dayIndex}/wear`, {
      method: "POST",
      body: JSON.stringify({ itemIds }),
    });
  },

  regenerateDay(
    dayIndex: number,
    excludeItemIds?: string[],
    lat?: number,
    lon?: number,
  ): Promise<{ outfit: LookbookOutfit | null }> {
    return apiFetch<{ outfit: LookbookOutfit | null }>("/lookbook/regenerate-day", {
      method: "POST",
      body: JSON.stringify({ dayIndex, excludeItemIds, lat, lon }),
    });
  },
};

/* ---------- Family types ---------- */

export interface FamilyMemberInfo {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface FamilyMembership {
  id: string;
  familyId: string;
  userId: string;
  role: string;
  user: FamilyMemberInfo;
}

export interface FamilyData {
  id: string;
  name: string;
  createdAt: string;
  members: FamilyMembership[];
  myRole: string;
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

/* ---------- Family API ---------- */

export const familyApi = {
  list(): Promise<{ families: FamilyData[] }> {
    return apiFetch("/family");
  },

  create(name: string): Promise<{ family: FamilyData }> {
    return apiFetch("/family", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  update(familyId: string, name: string): Promise<{ family: FamilyData }> {
    return apiFetch(`/family/${familyId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },

  remove(familyId: string): Promise<{ ok: boolean }> {
    return apiFetch(`/family/${familyId}`, { method: "DELETE" });
  },

  addMember(
    familyId: string,
    email: string,
    role?: string,
  ): Promise<{ member: FamilyMembership }> {
    return apiFetch(`/family/${familyId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },

  removeMember(familyId: string, userId: string): Promise<{ ok: boolean }> {
    return apiFetch(`/family/${familyId}/members/${userId}`, {
      method: "DELETE",
    });
  },

  getMemberWardrobe(
    familyId: string,
    memberId: string,
  ): Promise<{ items: WardrobeItem[] }> {
    return apiFetch(`/family/${familyId}/members/${memberId}/wardrobe`);
  },
};

/* ---------- Wardrobe API ---------- */

export const wardrobeApi = {
  getAll(): Promise<WardrobeItem[]> {
    return apiFetch<WardrobeItem[]>("/import/wardrobe");
  },

  deleteItem(itemId: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/import/wardrobe/${itemId}`, {
      method: "DELETE",
    });
  },
};

/* ---------- Styling API ---------- */

export interface StylingWeather {
  temp: number;
  feelsLike: number;
  condition: string;
  location: string;
}

export interface OutfitSuggestion {
  name: string;
  items: WardrobeItem[];
  stylingTip: string;
  confidence: number;
}

export interface StylingResponse {
  outfits: OutfitSuggestion[];
  weather: StylingWeather;
  candidateCount?: number;
  message?: string;
  avgCostPerWear?: number;
}

export const stylingApi = {
  suggest(params: {
    mood: { energy: number; boldness: number };
    lat?: number;
    lon?: number;
    formalityMin?: number;
    formalityMax?: number;
  }): Promise<StylingResponse> {
    return apiFetch<StylingResponse>("/styling/suggest", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
};

/* ---------- Scanner API ---------- */

export interface ScanResult {
  tags: {
    category: string;
    subcategory: string;
    colorPrimary: string;
    colorHex: string;
    pattern: string;
    fabric: string;
    formalityLevel: number;
    confidence: number;
  };
  verdict: "BUY" | "SKIP" | "CONSIDER";
  reasons: string[];
  stats: {
    sameCategoryCount: number;
    sameColorCount: number;
    samePatternCount: number;
    newOutfitPotential: number;
    projectedCostPerWear: string;
    avgWearsInWardrobe: number;
  };
}

export const scannerApi = {
  analyze(image: string, mimeType: string): Promise<ScanResult> {
    return apiFetch<ScanResult>("/scanner/analyze", {
      method: "POST",
      body: JSON.stringify({ image, mimeType }),
    });
  },
};

/* ---------- Matching API ---------- */

export interface MatchResult {
  breakdown: Array<{
    category: string;
    color: string;
    pattern: string;
    description: string;
  }>;
  recreations: Array<{
    name: string;
    items: Array<{
      id: string;
      category: string;
      colorPrimary: string;
      imageUrl: string;
      thumbnailUrl: string | null;
      subcategory: string | null;
      matchScore: number;
    }>;
    overallScore: number;
  }>;
}

export const matchingApi = {
  analyze(image: string, mimeType: string): Promise<MatchResult> {
    return apiFetch<MatchResult>("/matching/analyze", {
      method: "POST",
      body: JSON.stringify({ image, mimeType }),
    });
  },
};

/* ---------- Analytics API ---------- */

export const analyticsApi = {
  getDashboard(): Promise<Record<string, unknown>> {
    return apiFetch<Record<string, unknown>>("/analytics/dashboard");
  },
};
