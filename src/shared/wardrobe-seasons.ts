export const WARDROBE_SEASONS = [
  "spring",
  "summer",
  "fall",
  "winter",
  "spring-summer",
  "summer-fall",
  "fall-winter",
  "winter-spring",
  "demi",
  "all",
] as const;

export type WardrobeSeason = (typeof WARDROBE_SEASONS)[number];
export type WeatherSeason = "spring" | "summer" | "fall" | "winter";

const SEASON_MATCHES: Record<WardrobeSeason, readonly WeatherSeason[]> = {
  spring: ["spring"],
  summer: ["summer"],
  fall: ["fall"],
  winter: ["winter"],
  "spring-summer": ["spring", "summer"],
  "summer-fall": ["summer", "fall"],
  "fall-winter": ["fall", "winter"],
  "winter-spring": ["winter", "spring"],
  demi: ["spring", "fall"],
  all: ["spring", "summer", "fall", "winter"],
};

export function isWardrobeSeason(value: string | null | undefined): value is WardrobeSeason {
  return WARDROBE_SEASONS.includes(value as WardrobeSeason);
}

export function wardrobeSeasonMatchesWeather(
  itemSeason: string | null | undefined,
  weatherSeason: string | null | undefined,
): boolean {
  if (!itemSeason || !weatherSeason) return true;
  if (!isWardrobeSeason(itemSeason)) return true;
  if (!isWardrobeSeason(weatherSeason)) return itemSeason === "all";
  if (weatherSeason === "all") return true;
  return SEASON_MATCHES[itemSeason].includes(weatherSeason as WeatherSeason);
}

