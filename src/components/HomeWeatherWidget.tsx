import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CloudSun, Loader2, MapPin, Navigation, RefreshCw } from "lucide-react";
import { profileApi, stylingApi, type LocationData, type WeatherResponse } from "../services/api";
import { useGeolocation } from "../hooks/useGeolocation";
import { useI18n } from "../i18n";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; location: LocationData; weather: WeatherResponse | null }
  | { status: "error"; message: string };

function weatherEmoji(condition: string): string {
  switch (condition) {
    case "Clear":
      return "☀️";
    case "Clouds":
      return "☁️";
    case "Rain":
      return "☂️";
    case "Snow":
      return "❄️";
    case "Drizzle":
      return "🌦️";
    case "Thunderstorm":
      return "⚡";
    case "Fog":
      return "🌫️";
    default:
      return "◐";
  }
}

function shortDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function hasCoords(location: LocationData | null): location is LocationData & { lat: number; lon: number } {
  return typeof location?.lat === "number" && typeof location.lon === "number";
}

export function HomeWeatherWidget() {
  const { t } = useI18n();
  const { state: geoState, request: requestGeo } = useGeolocation();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [city, setCity] = useState("");
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWeather = useCallback(async (location: LocationData) => {
    if (!hasCoords(location)) {
      setState({ status: "ready", location, weather: null });
      setEditing(true);
      return;
    }

    const weather = await stylingApi.weather(location.lat, location.lon);
    setState({
      status: "ready",
      location: {
        ...location,
        city: location.city ?? weather.location,
      },
      weather: {
        ...weather,
        location: location.city ?? weather.location,
      },
    });
    setEditing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    profileApi
      .getLocation()
      .then(async (location) => {
        if (cancelled) return;
        await loadWeather(location);
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: "error", message: err instanceof Error ? err.message : "weather_failed" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadWeather]);

  useEffect(() => {
    if (geoState.status !== "success") return;
    void loadWeather(geoState.data);
  }, [geoState, loadWeather]);

  const forecast = useMemo(
    () => (state.status === "ready" ? state.weather?.daily.slice(0, 3) ?? [] : []),
    [state],
  );

  const handleCitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = city.trim();
    if (!query) return;
    setSubmitting(true);
    try {
      const resolved = await profileApi.geocodeCity(query);
      await loadWeather(resolved);
      setCity("");
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error && err.message === "city_not_found"
          ? t("location.cityNotFound")
          : t("weather.failed"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetect = async () => {
    setSubmitting(true);
    try {
      await requestGeo();
    } finally {
      setSubmitting(false);
    }
  };

  const location = state.status === "ready" ? state.location : null;
  const weather = state.status === "ready" ? state.weather : null;
  const needsLocation = state.status === "ready" && !weather;

  return (
    <section className="luxe-card overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="spotlight-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(201,165,90,0.1)] text-[var(--accent)]">
            <CloudSun size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-subtitle">{t("weather.kicker")}</p>
            {state.status === "loading" ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader2 size={14} className="animate-spin" />
                {t("weather.loading")}
              </div>
            ) : weather ? (
              <div className="mt-2 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <p className="text-4xl font-semibold leading-none text-[var(--text-primary)]">
                    {weatherEmoji(weather.condition)} {Math.round(weather.temp)}°
                  </p>
                  <div className="pb-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {(location?.city ?? weather.location) || t("weather.locationUnknown")}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {weather.condition}
                      {weather.source === "mock" ? ` · ${t("weather.estimated")}` : ""}
                    </p>
                  </div>
                </div>
                {forecast.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {forecast.map((day) => (
                      <div key={day.date} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          {shortDate(day.date)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                          {weatherEmoji(day.condition)} {Math.round(day.tempMax)}°/{Math.round(day.tempMin)}°
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">{t("weather.setTitle")}</h2>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{t("weather.setDesc")}</p>
              </div>
            )}
          </div>
        </div>

        <div className="w-full space-y-3 lg:max-w-sm">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDetect}
              disabled={submitting || geoState.status === "loading"}
              className="primary-action inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60"
            >
              {geoState.status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
              {t("location.detectAuto")}
            </button>
            {!needsLocation && (
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className="ghost-action inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
              >
                <MapPin size={14} />
                {t("weather.changeLocation")}
              </button>
            )}
          </div>

          {(editing || needsLocation) && (
            <form onSubmit={handleCitySubmit} className="flex gap-2">
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder={t("location.enterCity")}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]/45"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || city.trim().length === 0}
                className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {t("common.save")}
              </button>
            </form>
          )}

          {geoState.status === "error" && (
            <p className="flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle size={14} />
              {geoState.reason === "permission_denied" ? t("location.denied") : geoState.message}
            </p>
          )}
          {state.status === "error" && (
            <p className="flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle size={14} />
              {state.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
