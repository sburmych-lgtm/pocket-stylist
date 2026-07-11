import { useEffect, useMemo, useState } from "react";

const DEFAULT_THRESHOLD_PX = 82;
const MAX_PULL_PX = 118;

type PullState =
  | { status: "idle"; distance: number }
  | { status: "pulling"; distance: number }
  | { status: "ready"; distance: number }
  | { status: "refreshing"; distance: number };

interface PullToRefreshOptions {
  thresholdPx?: number;
  onRefresh?: () => void;
}

interface PullToRefreshResult {
  distance: number;
  progress: number;
  ready: boolean;
  refreshing: boolean;
  visible: boolean;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, button, a, [contenteditable='true']"),
  );
}

export function usePullToRefresh(options: PullToRefreshOptions = {}): PullToRefreshResult {
  const threshold = options.thresholdPx ?? DEFAULT_THRESHOLD_PX;
  const onRefresh = options.onRefresh ?? (() => window.location.reload());
  const [state, setState] = useState<PullState>({ status: "idle", distance: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!("ontouchstart" in window)) return undefined;

    let startY: number | null = null;
    let active = false;

    const resetSoon = () => {
      window.setTimeout(() => setState({ status: "idle", distance: 0 }), 350);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || isInteractiveTarget(event.target)) {
        startY = null;
        active = false;
        return;
      }
      startY = event.touches[0]?.clientY ?? null;
      active = startY !== null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!active || startY === null || window.scrollY > 0) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) return;

      const rawDistance = currentY - startY;
      if (rawDistance <= 0) {
        setState({ status: "idle", distance: 0 });
        return;
      }

      const distance = Math.min(MAX_PULL_PX, Math.round(rawDistance * 0.55));
      setState({
        status: distance >= threshold ? "ready" : "pulling",
        distance,
      });
    };

    const onTouchEnd = () => {
      if (!active) return;
      active = false;
      startY = null;
      setState((current) => {
        if (current.status === "ready") {
          window.setTimeout(onRefresh, 120);
          resetSoon();
          return { status: "refreshing", distance: threshold };
        }
        return { status: "idle", distance: 0 };
      });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, threshold]);

  return useMemo(
    () => ({
      distance: state.distance,
      progress: Math.min(1, state.distance / threshold),
      ready: state.status === "ready",
      refreshing: state.status === "refreshing",
      visible: state.status !== "idle",
    }),
    [state, threshold],
  );
}

