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

  getMe(): Promise<AuthUser> {
    return apiFetch<AuthUser>("/auth/me");
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
