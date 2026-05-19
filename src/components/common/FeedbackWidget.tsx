import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { MessageCircle, X, Send, CheckCircle2 } from "lucide-react";
import { feedbackApi } from "../../services/api";
import { useI18n } from "../../i18n";

type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "error"; error: string };

/**
 * Floating "Зв'язок з нами" button + modal. Mounted once in <Layout/> so it's
 * available on every authed page. Submission goes to POST /api/feedback which
 * persists into the Feedback table (anonymous OK).
 */
export function FeedbackWidget({ initialEmail }: { initialEmail?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [state, setState] = useState<SendState>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = message.trim();
      if (trimmed.length < 3) {
        setState({ status: "error", error: t("feedback.tooShort") });
        return;
      }
      setState({ status: "sending" });
      try {
        await feedbackApi.send(
          trimmed,
          email.trim() || undefined,
          typeof window !== "undefined" ? window.location.pathname : undefined,
        );
        setState({ status: "sent" });
        setMessage("");
        setTimeout(() => {
          setOpen(false);
          setState({ status: "idle" });
        }, 1800);
      } catch (err) {
        setState({
          status: "error",
          error: err instanceof Error ? err.message : t("common.error"),
        });
      }
    },
    [message, email, t],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("feedback.open")}
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[var(--bg-overlay)] text-[var(--accent)] shadow-[0_12px_28px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-all hover:scale-105 hover:bg-[rgba(201,165,90,0.16)] md:bottom-6"
        title={t("feedback.open")}
      >
        <MessageCircle size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm md:items-center md:justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-white/[0.06] bg-[var(--bg-surface)] p-6 shadow-2xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2
                  id="feedback-title"
                  className="text-lg font-semibold text-[var(--text-primary)]"
                >
                  {t("feedback.title")}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {t("feedback.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("common.close")}
                className="rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            {state.status === "sent" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 size={32} className="text-[var(--success)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {t("feedback.sent")}
                </p>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={handleSubmit} noValidate>
                <label className="block">
                  <span className="sr-only">{t("login.emailLabel")}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("feedback.emailPlaceholder")}
                    autoComplete="email"
                    maxLength={254}
                    disabled={state.status === "sending"}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
                  />
                </label>
                <label className="block">
                  <span className="sr-only">{t("feedback.title")}</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("feedback.messagePlaceholder")}
                    required
                    rows={5}
                    maxLength={2000}
                    disabled={state.status === "sending"}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
                  />
                </label>

                {state.status === "error" && (
                  <p
                    role="alert"
                    className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]"
                  >
                    {state.error}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {message.length}/2000
                  </p>
                  <button
                    type="submit"
                    disabled={state.status === "sending" || message.trim().length < 3}
                    className="gold-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    <Send size={14} />
                    {state.status === "sending" ? t("login.signingIn") : t("feedback.send")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
