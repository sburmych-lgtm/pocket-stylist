import { useState } from "react";
import type { FormEvent } from "react";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useGeolocation } from "../hooks/useGeolocation";
import { profileApi } from "../services/api";
import { useI18n } from "../i18n";

type CityState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

interface LocationRequestProps {
  /** Called once a location is successfully saved on the server. */
  onResolved?: () => void;
}

/**
 * Dashboard banner shown when the current user has no location saved.
 *
 * Two paths:
 *   1. "Detect automatically" → browser geolocation → POST /api/profile/location
 *   2. City fallback         → user types a city → server geocodes via Open-Meteo
 *
 * Renders nothing once the location has been saved (parent should also gate
 * on `user.lat == null`, but we keep the success message visible briefly
 * for UX confirmation).
 */
export function LocationRequest({ onResolved }: LocationRequestProps) {
  const { t } = useI18n();
  const { state: geoState, request: requestGeo } = useGeolocation();
  const [city, setCity] = useState("");
  const [cityState, setCityState] = useState<CityState>({ status: "idle" });

  async function handleCitySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (city.trim().length === 0) return;

    setCityState({ status: "submitting" });
    try {
      await profileApi.geocodeCity(city.trim());
      setCityState({ status: "idle" });
      onResolved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "city_not_found";
      setCityState({
        status: "error",
        message: msg === "city_not_found" ? t("location.cityNotFound") : msg,
      });
    }
  }

  // Surface "success" once the geolocation flow lands.
  if (geoState.status === "success") {
    return (
      <section
        role="status"
        className="luxe-card flex items-center gap-3 border-emerald-500/30 bg-emerald-500/5 p-4"
      >
        <CheckCircle2 size={20} className="text-emerald-400" />
        <p className="text-sm text-[var(--text-primary)]">
          {t("location.detected")}
          {geoState.data.city ? ` — ${geoState.data.city}` : ""}
        </p>
      </section>
    );
  }

  const geoDenied =
    geoState.status === "error" && geoState.reason === "permission_denied";

  return (
    <section className="luxe-card p-5">
      <div className="flex items-start gap-4">
        <div className="spotlight-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(201,165,90,0.1)] text-[var(--accent)]">
          <MapPin size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="section-subtitle">{t("location.permissionAsk")}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t("location.permissionAsk")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void requestGeo();
              }}
              disabled={geoState.status === "loading"}
              className="primary-action inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
            >
              {geoState.status === "loading" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MapPin size={14} />
              )}
              {t("location.detectAuto")}
            </button>
          </div>

          {geoDenied && (
            <p className="flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle size={14} />
              {t("location.denied")}
            </p>
          )}

          <form
            onSubmit={handleCitySubmit}
            className="flex flex-wrap items-center gap-2 pt-2"
          >
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("location.enterCity")}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
              disabled={cityState.status === "submitting"}
            />
            <button
              type="submit"
              disabled={
                cityState.status === "submitting" || city.trim().length === 0
              }
              className="ghost-action inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
            >
              {cityState.status === "submitting" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {t("common.save")}
            </button>
          </form>

          {cityState.status === "error" && (
            <p className="flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle size={14} />
              {cityState.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
