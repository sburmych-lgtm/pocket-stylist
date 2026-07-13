import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { authApi } from "../services/api";
import { useI18n } from "../i18n";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      const trimmed = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(trimmed)) {
        setError(t("login.invalidEmail"));
        return;
      }
      setInProgress(true);
      try {
        // Uniform server response — success regardless of whether the email
        // exists. We always show the same confirmation screen.
        await authApi.requestPasswordReset(trimmed);
        setSent(true);
      } catch {
        // Even on a network error, don't leak anything — show the neutral
        // confirmation. The user can retry from their inbox flow.
        setSent(true);
      } finally {
        setInProgress(false);
      }
    },
    [email, t],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,165,90,0.05)_0%,transparent_60%)]" />

      <div className="animate-fade-in-up relative w-full max-w-sm rounded-3xl border border-white/[0.06] bg-[var(--bg-surface)] p-8 shadow-2xl shadow-black/40">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-wide text-[var(--accent)]">
            {t("brand.name")}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t("forgotPassword.subtitle")}
          </p>
        </div>

        {sent ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-[var(--accent)]" aria-hidden="true" />
            </div>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              {t("forgotPassword.sent")}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              <ArrowLeft size={16} />
              {t("forgotPassword.backToLogin")}
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-4 py-3 text-center text-sm text-[var(--danger)]"
              >
                {error}
              </div>
            )}

            <label className="block">
              <span className="sr-only">{t("login.emailLabel")}</span>
              <div className="relative">
                <Mail
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  required
                  disabled={inProgress}
                  className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)]/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={inProgress}
              className="gold-btn flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              <Send size={16} />
              {inProgress ? t("forgotPassword.sending") : t("forgotPassword.submit")}
            </button>

            <div className="pt-1 text-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]"
              >
                <ArrowLeft size={14} />
                {t("forgotPassword.backToLogin")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
