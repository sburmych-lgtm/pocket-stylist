interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  condition: string;
  icon: string;
  location: string;
}

const cache = new Map<string, { data: WeatherData; expiry: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const isConfigured =
  !!process.env.OPENWEATHER_API_KEY &&
  process.env.OPENWEATHER_API_KEY !== "MOCK_KEY";

function mockWeather(lat: number, _lon: number): WeatherData {
  // Generate plausible mock weather based on latitude
  const isNorthern = lat > 0;
  const month = new Date().getMonth(); // 0-11
  const isSummer = isNorthern ? month >= 4 && month <= 9 : month <= 3 || month >= 10;

  return {
    temp: isSummer ? 22 + Math.random() * 10 : 5 + Math.random() * 10,
    feelsLike: isSummer ? 24 + Math.random() * 8 : 3 + Math.random() * 8,
    humidity: 40 + Math.random() * 40,
    wind: 5 + Math.random() * 15,
    condition: isSummer ? "Clear" : "Clouds",
    icon: isSummer ? "01d" : "04d",
    location: "Mock City",
  };
}

export async function getWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.data;

  if (!isConfigured) {
    const data = mockWeather(lat, lon);
    cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
    return data;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const json = (await res.json()) as {
    main: { temp: number; feels_like: number; humidity: number };
    wind: { speed: number };
    weather: Array<{ main: string; icon: string }>;
    name: string;
  };

  const data: WeatherData = {
    temp: json.main.temp,
    feelsLike: json.main.feels_like,
    humidity: json.main.humidity,
    wind: json.wind.speed,
    condition: json.weather[0]?.main ?? "Unknown",
    icon: json.weather[0]?.icon ?? "01d",
    location: json.name,
  };

  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
  return data;
}

export function weatherToSeason(temp: number): string {
  if (temp >= 25) return "summer";
  if (temp >= 15) return "spring";
  if (temp >= 5) return "fall";
  return "winter";
}

export function weatherToFormality(_condition: string): { min: number; max: number } {
  // Weather doesn't restrict formality, but rain may suggest practical choices
  return { min: 1, max: 5 };
}

export type { WeatherData };
