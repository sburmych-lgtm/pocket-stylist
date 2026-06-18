import { useEffect, useState, useCallback } from "react";
import { billingApi } from "../services/api";
import type { BillingMe } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

/**
 * Lightweight polling hook for the user's effective subscription state.
 *
 * Polls /api/billing/me once on mount, then every 60 seconds while the
 * user stays on the page. Stops as soon as the user signs out. Designed to
 * be cheap and never block render — `data` starts as `null` and components
 * should treat that as "still loading, assume access" so we don't flash a
 * paywall during the first paint.
 */
export function useSubscription(): {
  data: BillingMe | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<BillingMe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const me = await billingApi.getMe();
      setData(me);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("billing_failed"));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setData(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      try {
        const me = await billingApi.getMe();
        if (!cancelled) setData(me);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error("billing_failed"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const id = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isAuthenticated, refresh]);

  return { data, isLoading, error, refresh };
}
