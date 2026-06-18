import { useCallback, useState } from "react";
import { profileApi, type LocationData } from "../services/api";

/**
 * Discriminated union per .claude/rules/typescript-react.md — explicit
 * status field instead of multiple booleans.
 *
 * - `idle`     — user has not yet requested permission
 * - `loading`  — `navigator.geolocation.getCurrentPosition` is in flight
 *                OR the resulting POST to /api/profile/location is in flight
 * - `success`  — coords resolved and persisted on the server
 * - `error`    — either permission denied, position unavailable, or
 *                the network save failed. `reason` tells the UI which.
 */
export type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: LocationData }
  | { status: "error"; reason: GeolocationErrorReason; message: string };

export type GeolocationErrorReason =
  | "unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "save_failed";

interface UseGeolocationResult {
  state: GeolocationState;
  /** Request the browser's current position and save it on the profile. */
  request: () => Promise<void>;
  /** Reset back to `idle` (e.g. after the user dismisses the banner). */
  reset: () => void;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 5 * 60 * 1000, // 5 min
};

function mapGeoError(
  err: GeolocationPositionError,
): { reason: GeolocationErrorReason; message: string } {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return { reason: "permission_denied", message: "permission_denied" };
    case err.POSITION_UNAVAILABLE:
      return { reason: "position_unavailable", message: "position_unavailable" };
    case err.TIMEOUT:
      return { reason: "timeout", message: "timeout" };
    default:
      return { reason: "position_unavailable", message: err.message || "unknown" };
  }
}

function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * `useGeolocation` — encapsulates the browser geolocation flow + the
 * follow-up POST to `/api/profile/location`. Designed so the calling
 * component (LocationRequest banner) renders a single discriminated
 * `state` object.
 */
export function useGeolocation(): UseGeolocationResult {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  const request = useCallback(async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        status: "error",
        reason: "unsupported",
        message: "Geolocation API is not available in this browser.",
      });
      return;
    }

    setState({ status: "loading" });

    const coords = await new Promise<
      | { ok: true; lat: number; lon: number }
      | { ok: false; reason: GeolocationErrorReason; message: string }
    >((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ ok: true, lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => resolve({ ok: false, ...mapGeoError(err) }),
        GEO_OPTIONS,
      );
    });

    if (!coords.ok) {
      setState({ status: "error", reason: coords.reason, message: coords.message });
      return;
    }

    try {
      const saved = await profileApi.updateLocation({
        lat: coords.lat,
        lon: coords.lon,
        timezone: detectTimezone(),
      });
      setState({ status: "success", data: saved });
    } catch (err) {
      const message = err instanceof Error ? err.message : "save_failed";
      setState({ status: "error", reason: "save_failed", message });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, request, reset };
}
