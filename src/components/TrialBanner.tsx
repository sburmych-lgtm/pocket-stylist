import { useSubscription } from "../hooks/useSubscription";
import { useI18n } from "../i18n";
import { Sparkles } from "lucide-react";

/**
 * Slim banner that nudges the user toward upgrading when fewer than three
 * days of trial remain. Renders nothing when:
 *   - Stripe isn't configured (graceful — no paywall flow exists),
 *   - subscription is paid/active,
 *   - days-left is still comfortable (> 3), or
 *   - the call hasn't finished yet (avoid flicker on first paint).
 * The CTA dispatches the same `paywall:open` event used by the 402 interceptor.
 */
export function TrialBanner() {
  const { data } = useSubscription();
  const { t } = useI18n();

  if (!data) return null;
  if (!data.stripeConfigured) return null;
  if (data.isPaid) return null;
  if (data.status !== "trialing") return null;
  if (data.daysLeft > 3) return null;

  function openPaywall() {
    window.dispatchEvent(new CustomEvent("paywall:open", { detail: { reason: "banner" } }));
  }

  const message =
    data.daysLeft <= 0
      ? t("billing.trialExpired")
      : t("billing.trialDaysLeft", { days: data.daysLeft });

  return (
    <div className="fixed inset-x-0 top-[5.25rem] z-40 px-3 md:top-[5.75rem]">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-[rgba(201,165,90,0.32)] bg-[rgba(201,165,90,0.08)] px-4 py-2.5 text-sm text-[var(--text-primary)] shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur">
        <Sparkles size={16} className="shrink-0 text-[var(--accent)]" />
        <p className="flex-1 truncate">{message}</p>
        <button
          type="button"
          onClick={openPaywall}
          className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#0a0c12] transition hover:brightness-110"
        >
          {t("billing.upgrade")}
        </button>
      </div>
    </div>
  );
}
