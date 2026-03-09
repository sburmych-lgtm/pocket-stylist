import { Cloud, CloudRain, CloudSun, MapPin, Snowflake, SunMedium } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface WeatherBadgeProps {
  temp: number;
  condition: string;
  location: string;
}

function weatherIcon(condition: string): LucideIcon {
  if (condition === "Clear") {
    return SunMedium;
  }
  if (condition === "Clouds") {
    return CloudSun;
  }
  if (condition === "Rain" || condition === "Drizzle") {
    return CloudRain;
  }
  if (condition === "Snow") {
    return Snowflake;
  }
  return Cloud;
}

export function WeatherBadge({ temp, condition, location }: WeatherBadgeProps) {
  const Icon = weatherIcon(condition);

  return (
    <div className="floating-panel flex items-center gap-4 px-4 py-3">
      <div className="spotlight-ring flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(136,198,189,0.12)] text-[var(--accent-cool)]">
        <Icon size={19} />
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
