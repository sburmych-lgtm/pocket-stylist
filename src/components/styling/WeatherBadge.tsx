interface WeatherBadgeProps {
  temp: number;
  condition: string;
  location: string;
}

export function WeatherBadge({ temp, condition, location }: WeatherBadgeProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1a1a2e]/80 px-4 py-3 backdrop-blur-sm">
      <div className="text-2xl">
        {condition === "Clear"
          ? "\u2600\uFE0F"
          : condition === "Clouds"
            ? "\u2601\uFE0F"
            : condition === "Rain"
              ? "\uD83C\uDF27\uFE0F"
              : condition === "Snow"
                ? "\u2744\uFE0F"
                : "\uD83C\uDF24\uFE0F"}
      </div>
      <div>
        <p className="text-lg font-semibold text-[#f0ece4]">
          {Math.round(temp)}\u00B0C
        </p>
        <p className="text-xs text-[#f0ece4]/45">
          {condition} \u00B7 {location}
        </p>
      </div>
    </div>
  );
}
