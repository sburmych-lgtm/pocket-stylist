import { z } from "zod";

/**
 * Open-Meteo weather service.
 *
 * Replaces OpenWeatherMap because Open-Meteo:
 *   • is free and key-less
 *   • accepts raw lat/lon (no city geocoding before the request)
 *   • returns both current + 7-day daily forecast in a single call
 *
 * We keep the public surface familiar (`tempC`, `condition`, `location`,
 * plus the legacy `temp` / `feelsLike` / `humidity` / `wind` / `icon` so
 * existing callers don't break) and add a `daily` array used by the
 * weekly Lookbook. When lat/lon are missing or the API fails we fall
 * back to mock data so the UI never sees an exception.
 */

interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  condition: string;
  precipMm: number;
}

interface WeatherData {
  // Primary fields exposed by the new API
  tempC: number;
  condition: string;
  location: string;
  daily: DailyForecast[];
  /** "live" = real Open-Meteo response, "mock" = fabricated fallback. */
  source: "live" | "mock";
  /** Current precipitation in mm (0 when dry / unknown). */
  precipMm: number;
  // Backwards-compat fields used by existing callers (lookbook / styling)
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  icon: string;
}

interface GeocodeResult {
  lat: number;
  lon: number;
  name: string;
  country: string;
  timezone: string;
}

const cache = new Map<string, { data: WeatherData; expiry: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT_MS = 10_000;

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

/* ---------- Weather-code → label mapping ---------- */

// WMO weather codes — see https://open-meteo.com/en/docs (Variables / weather_code)
function mapWeatherCode(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: "Clear", icon: "01d" };
  if (code >= 1 && code <= 3) return { condition: "Clouds", icon: "03d" };
  if (code >= 45 && code <= 48) return { condition: "Fog", icon: "50d" };
  if (code >= 51 && code <= 67) return { condition: "Rain", icon: "10d" };
  if (code >= 71 && code <= 77) return { condition: "Snow", icon: "13d" };
  if (code >= 80 && code <= 86) return { condition: "Showers", icon: "09d" };
  if (code >= 95 && code <= 99) return { condition: "Thunderstorm", icon: "11d" };
  return { condition: "Unknown", icon: "01d" };
}

/* ---------- Zod schemas ---------- */

const OpenMeteoSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  current: z
    .object({
      temperature_2m: z.number(),
      weather_code: z.number(),
      precipitation: z.number().optional(),
    })
    .optional(),
  daily: z
    .object({
      time: z.array(z.string()).min(1),
      temperature_2m_max: z.array(z.number()).min(1),
      temperature_2m_min: z.array(z.number()).min(1),
      weather_code: z.array(z.number()).min(1),
      precipitation_sum: z.array(z.number()).min(1),
    })
    .superRefine((daily, ctx) => {
      const expected = daily.time.length;
      for (const [key, values] of Object.entries(daily)) {
        if (values.length !== expected) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "forecast_arrays_must_have_equal_length",
          });
        }
      }
    })
    .optional(),
});

const GeocodeSchema = z.object({
  results: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        name: z.string(),
        country: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

/* ---------- Mock fallback ---------- */

function mockDaily(lat: number, baseTemp: number): DailyForecast[] {
  const conditions = ["Clear", "Clouds", "Clear", "Rain", "Clouds", "Clear", "Clouds"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const variance = Math.sin((i + lat) * 1.3) * 4;
    const tempMax = Math.round((baseTemp + variance + 3) * 10) / 10;
    const tempMin = Math.round((baseTemp + variance - 3) * 10) / 10;
    return {
      date: date.toISOString().split("T")[0],
      tempMax,
      tempMin,
      condition: conditions[i % conditions.length],
      precipMm: i % 3 === 0 ? 1.2 : 0,
    };
  });
}

function mockWeather(lat?: number, _lon?: number): WeatherData {
  // Generate plausible mock weather based on latitude / season.
  const safeLat = typeof lat === "number" ? lat : 50.45;
  const isNorthern = safeLat > 0;
  const month = new Date().getMonth();
  const isSummer = isNorthern
    ? month >= 4 && month <= 9
    : month <= 3 || month >= 10;
  const baseTemp = isSummer ? 22 + Math.random() * 6 : 5 + Math.random() * 8;
  const tempC = Math.round(baseTemp * 10) / 10;
  const condition = isSummer ? "Clear" : "Clouds";
  const icon = isSummer ? "01d" : "04d";

  return {
    tempC,
    condition,
    location: "Mock City",
    daily: mockDaily(safeLat, tempC),
    source: "mock",
    precipMm: 0,
    // Legacy aliases
    temp: tempC,
    feelsLike: tempC,
    humidity: 50,
    wind: 8,
    icon,
  };
}

/* ---------- Public API ---------- */

interface FetchWeatherInput {
  lat?: number | null;
  lon?: number | null;
  timezone?: string | null;
}

/**
 * Fetch current + 7-day weather for the given coordinates.
 *
 * When `lat`/`lon` are missing or the upstream HTTP call fails we silently
 * return mock data so callers (Lookbook, Styling) keep working.
 */
export async function fetchWeather(
  input: FetchWeatherInput,
): Promise<WeatherData> {
  const { lat, lon } = input;
  if (typeof lat !== "number" || typeof lon !== "number") {
    return mockWeather();
  }

  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)},${input.timezone ?? "auto"}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const tz = input.timezone && input.timezone.length > 0 ? input.timezone : "auto";
  const url =
    `${OPEN_METEO_URL}` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=temperature_2m,weather_code,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum` +
    `&timezone=${encodeURIComponent(tz)}` +
    `&forecast_days=7`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      console.warn(`[weather] Open-Meteo HTTP ${res.status}, using mock`);
      return mockWeather(lat, lon);
    }

    const raw = (await res.json()) as unknown;
    const parsed = OpenMeteoSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("[weather] Open-Meteo schema mismatch, using mock");
      return mockWeather(lat, lon);
    }

    const { current, daily } = parsed.data;
    const currentCode = current?.weather_code ?? 0;
    const { condition, icon } = mapWeatherCode(currentCode);
    const tempC =
      current?.temperature_2m ??
      (daily
        ? ((daily.temperature_2m_max[0] ?? 0) + (daily.temperature_2m_min[0] ?? 0)) / 2
        : mockWeather(lat, lon).tempC);

    const dailyForecast: DailyForecast[] = daily
      ? daily.time.map((date, i) => {
          const code = daily.weather_code[i] ?? 0;
          return {
            date,
            tempMax: daily.temperature_2m_max[i] ?? tempC,
            tempMin: daily.temperature_2m_min[i] ?? tempC,
            condition: mapWeatherCode(code).condition,
            precipMm: daily.precipitation_sum[i] ?? 0,
          };
        })
      : mockDaily(lat, tempC);

    const data: WeatherData = {
      tempC,
      condition,
      location: parsed.data.timezone ?? "",
      daily: dailyForecast,
      source: "live",
      precipMm: current?.precipitation ?? 0,
      // Legacy aliases — keep existing callers working.
      temp: tempC,
      feelsLike: tempC,
      humidity: 50,
      wind: 8,
      icon,
    };

    cache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
    return data;
  } catch (err) {
    console.warn("[weather] Open-Meteo fetch failed, using mock:", err);
    return mockWeather(lat, lon);
  }
}

/**
 * Geocode a free-form city query to coordinates + IANA timezone.
 * Returns `null` if no match was found or the upstream call failed —
 * callers should surface a "city not found" message in that case.
 */
export async function geocodeCity(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  const url =
    `${OPEN_METEO_GEOCODE_URL}` +
    `?name=${encodeURIComponent(trimmed)}` +
    `&count=1` +
    `&language=uk` +
    `&format=json`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    const parsed = GeocodeSchema.safeParse(raw);
    if (!parsed.success) return null;

    const first = parsed.data.results?.[0];
    if (!first) return null;

    return {
      lat: first.latitude,
      lon: first.longitude,
      name: first.name,
      country: first.country ?? "",
      timezone: first.timezone ?? "auto",
    };
  } catch (err) {
    console.warn("[weather] geocodeCity failed:", err);
    return null;
  }
}

/* ---------- Legacy adapters ----------
 *
 * Older callers used `getWeather(lat, lon)` returning a single object and
 * `getWeatherForecast(lat, lon)` returning an array. We keep those
 * signatures working so we don't churn every call site, but underneath
 * they go through `fetchWeather`.
 */

export async function getWeather(lat: number, lon: number): Promise<WeatherData> {
  return fetchWeather({ lat, lon });
}

export async function getWeatherForecast(
  lat: number,
  lon: number,
): Promise<WeatherData[]> {
  const data = await fetchWeather({ lat, lon });
  // Convert each daily entry into a WeatherData-shaped object so existing
  // lookbook code that reads `.temp`, `.condition`, `.location`, `.icon`
  // keeps working without re-shaping every caller.
  return data.daily.map((d) => {
    const tempMid = (d.tempMax + d.tempMin) / 2;
    const icon = mapWeatherCode(0).icon; // placeholder; condition is the source of truth
    const { icon: condIcon } = pickIconForCondition(d.condition);
    return {
      tempC: tempMid,
      condition: d.condition,
      location: data.location,
      daily: data.daily,
      source: data.source,
      precipMm: d.precipMm,
      temp: tempMid,
      feelsLike: tempMid,
      humidity: 50,
      wind: 8,
      icon: condIcon || icon,
    };
  });
}

function pickIconForCondition(condition: string): { icon: string } {
  switch (condition) {
    case "Clear":
      return { icon: "01d" };
    case "Clouds":
      return { icon: "03d" };
    case "Fog":
      return { icon: "50d" };
    case "Rain":
      return { icon: "10d" };
    case "Snow":
      return { icon: "13d" };
    case "Showers":
      return { icon: "09d" };
    case "Thunderstorm":
      return { icon: "11d" };
    default:
      return { icon: "01d" };
  }
}

/**
 * Map a real-world temperature in °C onto our 4-season clothing bucket.
 * Tightened in May 2026 after a 26°C-day suggested a winter coat — the old
 * thresholds (25/15/5) treated everything from a chilly +6°C to a balmy
 * +24°C as borderline spring/fall, which made the AI prompt ambiguous.
 * New buckets line up with how most people actually dress in Kyiv-like
 * climates and feed the strict Gemini rule "season MUST match".
 */
export function weatherToSeason(temp: number): string {
  if (temp >= 22) return "summer";
  if (temp >= 15) return "spring";
  if (temp >= 7) return "fall";
  return "winter";
}

// Exposed for tests to reset state between cases.
export function _resetWeatherCache(): void {
  cache.clear();
}

export type { WeatherData, GeocodeResult, DailyForecast };
