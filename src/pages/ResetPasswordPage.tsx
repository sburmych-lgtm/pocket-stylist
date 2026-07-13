import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Lock, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";
import { authApi, setToken } from "../services/api";
import { useI18n } from "../i18n";

const PASSWORD_MIN_LENGTH = 8;

export function ResetPasswordPage() {
  const { t } = useI18n();

  // Token arrives in the URL fragment (#token=...) so it never hits server
  // logs or the Referer header.
  const token = useMemo(
    () => new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token"),
    [],
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapServerError = useCallback(
    (code: string | undefined): string => {
      switch (code) {
        case "password_too_short":
          return t("login.passwordTooShort", { min: String(PASSWORD_MIN_LENGTH) });
        case "password_too_long":
          return t("login.passwordTooLong");
        case "invalid_or_expired_token":
          return t("resetPassword.invalidToken");
        default:
          return t("resetPassword.failed");
      }
    },
    [t],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!token) {
        setError(t("resetPassword.invalidToken"));
        return;
      }
      if (password.length < PASSWORD_MIN_LENGTH) {
        setError(t("login.passwordTooShort", { min: String(PASSWORD_MIN_LENGTH) }));
        return;
      }
      if (password !== confirm) {
        setError(t("resetPassword.mismatch"));
        return;
      }
      setInProgress(true);
      try {
        const data = await authApi.resetPassword(token, password);
        // Auto-login: persist the fresh session, then hard-navigate so
        // AuthContext re-initialises as an authenticated user.
        setToken(data.token);
        window.location.assign("/");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setError(mapServerError(msg));
        setInProgress(false);
      }
    },
    [token, password, confirm, t, mapServerError],
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
            {t("resetPassword.subtitle")}
          </p>
        </div>

        {!token ? (
          <div className="space-y-6 text-center">
            <p className="text-sm leading-6 text-[var(--danger)]">
              {t("resetPassword.missingToken")}
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              {t("resetPassword.requestNew")}
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
              <span className="sr-only">{t("resetPassword.newPasswordLabel")}</span>
              <div className="relative">
                <Lock
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("resetPassword.newPasswordPlaceholder", {
                    min: String(PASSWORD_MIN_LENGTH),
                  })}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  disabled={inProgress}
                  className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-10 pr-12 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)]/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="sr-only">{t("resetPassword.confirmLabel")}</span>
              <div className="relative">
                <Lock
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("resetPassword.confirmPlaceholder")}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
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
              <KeyRound size={16} />
              {inProgress ? t("resetPassword.submitting") : t("resetPassword.submit")}
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
