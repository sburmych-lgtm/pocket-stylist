import { useEffect, useState } from "react";
import { X, Sparkles, Check } from "lucide-react";
import { billingApi } from "../services/api";
import { useSubscription } from "../hooks/useSubscription";
import { useI18n } from "../i18n";

/**
 * Modal that pops in response to the global `paywall:open` event.
 * The event is fired by:
 *   - the 402 API interceptor in src/services/api.ts,
 *   - the TrialBanner CTA, and
 *   - any future "upgrade" buttons (just dispatch `paywall:open`).
 *
 * Without Stripe configured we render a friendly "trial unlimited" state
 * instead of a broken checkout button — the app still works fully.
 */
export function PaywallModal() {
  const { data: sub } = useSubscription();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onOpen() {
      setError(null);
      setOpen(true);
    }
    window.addEventListener("paywall:open", onOpen);
    return () => window.removeEventListener("paywall:open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const priceDisplay =
    (import.meta.env.VITE_STRIPE_PRICE_DISPLAY as string | undefined) ?? "€4.99/міс";
  const stripeConfigured = sub?.stripeConfigured ?? false;

  async function handleCheckout() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await billingApi.checkout();
      window.location.href = url;
    } catch (err) {
      const code = err instanceof Error ? err.message : "checkout_failed";
      setError(code);
    } finally {
      setBusy(false);
    }
  }

  const bullets: string[] = [
    t("billing.bulletUnlimited"),
    t("billing.bulletFamily"),
    t("billing.bulletVoice"),
    t("billing.bulletTryOn"),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[var(--bg-overlay)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-[var(--text-muted)] transition hover:bg-white/[0.1] hover:text-[var(--text-primary)]"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(201,165,90,0.12)] text-[var(--accent)]">
            <Sparkles size={20} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-[var(--text-muted)]">
              {t("billing.kicker")}
            </p>
            <h2 id="paywall-title" className="font-display text-2xl text-[var(--text-primary)]">
              {t("billing.title")}
            </h2>
          </div>
        </div>

        {stripeConfigured ? (
          <p className="mb-5 text-sm text-[var(--text-secondary)]">
            {t("billing.subtitle", { price: priceDisplay })}
          </p>
        ) : (
          <p className="mb-5 text-sm text-[var(--text-secondary)]">
            {t("billing.freeForNow")}
          </p>
        )}

        <ul className="mb-6 space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-[var(--text-primary)]">
              <Check size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="mb-3 text-xs text-[var(--danger,#ef8a80)]">
            {t("billing.checkoutError")}: {error}
          </p>
        )}

        {stripeConfigured ? (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={busy}
            className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#0a0c12] transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? t("billing.redirecting") : t("billing.upgradeCta", { price: priceDisplay })}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-full border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)] transition hover:bg-white/[0.08]"
          >
            {t("common.close")}
          </button>
        )}
      </div>
    </div>
  );
}
