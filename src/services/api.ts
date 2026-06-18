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

interface ApiFetchOptions extends RequestInit {
  /** Optional client-side timeout in ms. Aborts the request and throws "timeout". */
  timeoutMs?: number;
}

async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const { timeoutMs, ...fetchOpts } = options ?? {};
  const controller = new AbortController();
  // Compose with any caller-supplied signal so they can also cancel.
  const callerSignal = fetchOpts.signal as AbortSignal | undefined;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const timeoutId = timeoutMs
    ? setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs)
    : undefined;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      headers: { ...headers, ...(fetchOpts.headers as Record<string, string> | undefined) },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // 402 Payment Required → fire global event so a paywall modal can pop
      // anywhere in the tree, then throw a tagged error so callers can
      // optionally render their own state too.
      if (res.status === 402 && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("paywall:open", { detail: body }),
        );
        throw new Error("subscription_required");
      }
      throw new Error((body as { error?: string }).error ?? `API error ${res.status}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("timeout");
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/* ---------- Auth types ---------- */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  genderMode: string;
  colorSeason: string | null;
  // Open-Meteo geolocation — null until the user grants permission or
  // enters a city. The dashboard LocationRequest banner reads `lat` to
  // decide whether to render.
  lat?: number | null;
  lon?: number | null;
  city?: string | null;
  timezone?: string | null;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

/* ---------- Location types ---------- */

export interface LocationData {
  lat: number | null;
  lon: number | null;
  city: string | null;
  timezone: string | null;
}

export interface LocationUpdatePayload {
  lat: number;
  lon: number;
  city?: string;
  timezone?: string;
}

export interface GeocodedLocation {
  lat: number;
  lon: number;
  city: string;
  timezone: string;
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

  loginEmail(email: string, password: string): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/email/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  registerEmail(
    email: string,
    password: string,
    name?: string,
    acceptedTerms?: boolean,
  ): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/auth/email/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, acceptedTerms }),
    });
  },

  async getMe(): Promise<AuthUser> {
    // Tight timeout so a degraded DB on Railway never freezes the login UI
    // on AuthContext init. 4 s is enough for a healthy round-trip; anything
    // longer means DB is down and we should fall through to the login page.
    const res = await apiFetch<{ user: AuthUser }>("/auth/me", { timeoutMs: 4_000 });
    return res.user;
  },
};

/* ---------- Drive types & API ---------- */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface DriveListResponse {
  files: DriveFile[];
  nextPageToken: string | null;
}

export const driveApi = {
  list(params: {
    folderId?: string;
    pageToken?: string;
    q?: string;
  } = {}): Promise<DriveListResponse> {
    const search = new URLSearchParams();
    if (params.folderId) search.set("folderId", params.folderId);
    if (params.pageToken) search.set("pageToken", params.pageToken);
    if (params.q) search.set("q", params.q);
    const qs = search.toString();
    return apiFetch<DriveListResponse>(`/import/drive/list${qs ? `?${qs}` : ""}`);
  },

  async download(fileId: string): Promise<{ base64: string; mimeType: string; fileName: string }> {
    return apiFetch("/import/drive-download", {
      method: "POST",
      body: JSON.stringify({ fileId }),
    });
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

export interface IngestResponse {
  id: string;
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
  createdAt: string;
  timings?: { uploadMs: number; geminiMs: number; dbMs: number; totalMs: number };
}

/**
 * Direct-ingestion: upload + analyze + commit in a single round-trip.
 * Replaces the old two-step analyze-then-save flow.
 */
export function ingestImage(image: string, mimeType: string, fileName: string) {
  return apiFetch<IngestResponse>("/import/ingest", {
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
  googleAuthConfigured: boolean;
  googleSignInConfigured: boolean;
  googleRedirectConfigured: boolean;
  googleDriveConfigured: boolean;
  googleDrivePickerConfigured: boolean;
  emailAuthEnabled: boolean;
  tryOnConfigured: boolean;
  /** ElevenLabs configured server-side. False means the client must use browser TTS. */
  ttsConfigured?: boolean;
  /** Set by the server when STRIPE_SECRET_KEY is configured. Drives the paywall. */
  stripeConfigured?: boolean;
  googleClientId: string | null;
  googlePickerApiKey: string | null;
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

export type StylistPersona = "classic" | "sassy" | "manly" | "kind";

export const STYLIST_PERSONAS = ["classic", "sassy", "manly", "kind"] as const;

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  genderMode: string;
  colorSeason: string | null;
  colorPalette: ColorPaletteEntry[] | null;
  avoidColors: ColorPaletteEntry[] | null;
  stylistPersona: StylistPersona;
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

  updatePersona(persona: StylistPersona): Promise<{ stylistPersona: StylistPersona }> {
    return apiFetch<{ stylistPersona: StylistPersona }>("/profile/persona", {
      method: "PATCH",
      body: JSON.stringify({ persona }),
    });
  },

  analyzeColor(image: string): Promise<ColorAnalysisResult> {
    return apiFetch<ColorAnalysisResult>("/profile/color-analysis", {
      method: "POST",
      body: JSON.stringify({ image }),
    });
  },

  getLocation(): Promise<LocationData> {
    return apiFetch<LocationData>("/profile/location");
  },

  /**
   * Update the user's stored location.
   * Pass `{ lat, lon, city?, timezone? }` from a browser geolocation result,
   * or `{ city }` alone to let the server geocode via Open-Meteo.
   */
  updateLocation(payload: LocationUpdatePayload | { city: string }): Promise<LocationData> {
    return apiFetch<LocationData>("/profile/location", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Convenience: ask the server to geocode a city query and save it on the
   * user's profile in a single round-trip. Returns the resolved location
   * (or throws "city_not_found" on no match).
   */
  geocodeCity(city: string): Promise<GeocodedLocation> {
    return apiFetch<LocationData>("/profile/location", {
      method: "PATCH",
      body: JSON.stringify({ city }),
    }).then((loc) => {
      if (loc.lat === null || loc.lon === null) {
        throw new Error("city_not_found");
      }
      return {
        lat: loc.lat,
        lon: loc.lon,
        city: loc.city ?? city,
        timezone: loc.timezone ?? "auto",
      };
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

export interface WardrobeItemPatch {
  category?: string;
  subcategory?: string | null;
  colorPrimary?: string;
  colorHex?: string | null;
  pattern?: string;
  fabric?: string | null;
  formalityLevel?: number;
  season?: "spring" | "summer" | "fall" | "winter" | "all";
  brand?: string | null;
}

export const wardrobeApi = {
  getAll(): Promise<WardrobeItem[]> {
    return apiFetch<WardrobeItem[]>("/import/wardrobe");
  },

  deleteItem(itemId: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/import/wardrobe/${itemId}`, {
      method: "DELETE",
    });
  },

  updateItem(itemId: string, patch: WardrobeItemPatch): Promise<{ item: WardrobeItem }> {
    return apiFetch<{ item: WardrobeItem }>(`/import/wardrobe/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
};

/* ---------- Feedback ---------- */

export const feedbackApi = {
  send(message: string, email?: string, source?: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/feedback", {
      method: "POST",
      body: JSON.stringify({ message, email, source }),
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

export interface TryOnResponse {
  imageUrl: string;
  durationMs: number;
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

  tryOn(modelImage: string, garmentImage: string): Promise<TryOnResponse> {
    // Fal.ai try-on can run ~10–30 s end-to-end on cold queues. 60 s
    // timeout matches our server-side `fal.subscribe` upper bound.
    return apiFetch<TryOnResponse>("/styling/tryon", {
      method: "POST",
      body: JSON.stringify({ modelImage, garmentImage }),
      timeoutMs: 60_000,
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

/* ---------- TTS API ---------- */

export interface TtsStatus {
  elevenlabsEnabled: boolean;
  voices: Record<StylistPersona, string>;
}

export const ttsApi = {
  async getStatus(): Promise<TtsStatus> {
    return apiFetch<TtsStatus>("/tts/status");
  },

  /**
   * POST /api/tts — synthesizes the text with the given persona voice.
   * Returns an audio/mpeg Blob ready to feed into `URL.createObjectURL`.
   * Throws "tts_unavailable" when the server is in browser-fallback mode.
   */
  async synthesize(text: string, persona: StylistPersona = "classic"): Promise<Blob> {
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/tts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, persona }),
    });
    if (!res.ok) {
      let errCode = `tts_status_${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) errCode = body.error;
      } catch {
        // body wasn't JSON — keep the generic code
      }
      throw new Error(errCode);
    }
    return res.blob();
  },
};

/* ---------- Billing ---------- */

export interface BillingMe {
  status: "trialing" | "active" | "past_due" | "canceled" | "none";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysLeft: number;
  isPaid: boolean;
  hasAccess: boolean;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
}

export const billingApi = {
  getMe(): Promise<BillingMe> {
    return apiFetch<BillingMe>("/billing/me");
  },
  checkout(): Promise<{ url: string; id: string }> {
    return apiFetch<{ url: string; id: string }>("/billing/checkout", {
      method: "POST",
    });
  },
  portal(): Promise<{ url: string }> {
    return apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
  },
};
