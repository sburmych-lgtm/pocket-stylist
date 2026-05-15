import { Cloud, CloudRain, CloudSun, MapPin, Snowflake, SunMedium } from "lucide-react";

interface WeatherBadgeProps {
  temp: number;
  condition: string;
  location: string;
}

function WeatherIcon({ condition }: { condition: string }) {
  if (condition === "Clear") {
    return <SunMedium size={19} />;
  }
  if (condition === "Clouds") {
    return <CloudSun size={19} />;
  }
  if (condition === "Rain" || condition === "Drizzle") {
    return <CloudRain size={19} />;
  }
  if (condition === "Snow") {
    return <Snowflake size={19} />;
  }
  return <Cloud size={19} />;
}

export function WeatherBadge({ temp, condition, location }: WeatherBadgeProps) {
  return (
    <div className="floating-panel flex items-center gap-4 px-4 py-3">
      <div className="spotlight-ring flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(136,198,189,0.12)] text-[var(--accent-cool)]">
        <WeatherIcon condition={condition} />
      </div>
      <div>
        <p className="text-lg font-semibold text-[var(--text-primary)]">
          {Math.round(temp)}°C
        </p>
        <p className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
          {condition}
          <span className="text-[var(--text-muted)]">·</span>
          <MapPin size={12} />
          {location}
        </p>
      </div>
    </div>
  );
}
