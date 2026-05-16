import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User as UserIcon, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getAppStatus } from "../services/api";
import type { AppStatus } from "../services/api";
import { useI18n } from "../i18n";

type AuthMode = "login" | "register";

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { loginWithEmail, registerWithEmail, loginDemo, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [status, setStatus] = useState<AppStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [authInProgress, setAuthInProgress] = useState(false);

  // Pick up authError from redirect callback URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectError = params.get("authError");
    if (redirectError) {
      window.history.replaceState({}, "", window.location.pathname);
      setAuthError(t("login.googleAuthError"));
    }
  }, [t]);

  useEffect(() => {
    getAppStatus()
      .then((s) => setStatus(s))
      .catch(() => setStatus(null))
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const mapServerError = useCallback(
    (code: string | undefined): string => {
      switch (code) {
        case "invalid_email":
          return t("login.invalidEmail");
        case "password_too_short":
          return t("login.passwordTooShort", { min: String(PASSWORD_MIN_LENGTH) });
        case "email_too_long":
          return t("login.emailTooLong");
        case "password_too_long":
          return t("login.passwordTooLong");
        case "name_too_long":
          return t("login.nameTooLong");
        case "invalid_payload":
        case "invalid_json":
          return t("login.invalidPayload");
        case "email_in_use":
          return t("login.emailInUse");
        case "email_reserved":
          return t("login.emailReserved");
        case "invalid_credentials":
          return t("login.invalidCredentials");
        default:
          return t("login.authError");
      }
    },
    [t],
  );

  const handleEmailSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setAuthError(null);

      const trimmedEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        setAuthError(t("login.invalidEmail"));
        return;
      }
      if (password.length < PASSWORD_MIN_LENGTH) {
        setAuthError(t("login.passwordTooShort", { min: String(PASSWORD_MIN_LENGTH) }));
        return;
      }

      setAuthInProgress(true);
      try {
        if (mode === "register") {
          await registerWithEmail(trimmedEmail, password, name.trim() || undefined);
        } else {
          await loginWithEmail(trimmedEmail, password);
        }
        navigate("/", { replace: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setAuthError(mapServerError(msg));
      } finally {
        setAuthInProgress(false);
      }
    },
    [email, password, name, mode, registerWithEmail, loginWithEmail, navigate, t, mapServerError],
  );

  const handleDemo = useCallback(async () => {
    setAuthError(null);
    setAuthInProgress(true);
    try {
      await loginDemo();
      navigate("/", { replace: true });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : t("login.authError"));
    } finally {
      setAuthInProgress(false);
    }
  }, [loginDemo, navigate, t]);

  if (isLoading || statusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  const googleEnabled = status?.googleRedirectConfigured ?? false;
  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setAuthError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,165,90,0.05)_0%,transparent_60%)]" />

      <div className="animate-fade-in-up relative w-full max-w-sm rounded-3xl border border-white/[0.06] bg-[var(--bg-surface)] p-8 shadow-2xl shadow-black/40">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-wide text-[var(--accent)]">
            {t("brand.name")}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{t("login.subtitle")}</p>
        </div>

        <div className="space-y-4">
          {authError && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-4 py-3 text-center text-sm text-[var(--danger)]"
            >
              {authError}
            </div>
          )}

          {authInProgress && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--text-secondary)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              {t("login.signingIn")}
            </div>
          )}

          {googleEnabled && !authInProgress && (
            <a
              href="/api/auth/google/redirect"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold text-[var(--text-primary)] transition-all duration-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t("login.continueWithGoogle")}
            </a>
          )}

          {googleEnabled && (
            <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <div className="h-px flex-1 bg-white/10" />
              <span>{t("login.or")}</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          )}

          <form className="space-y-3" onSubmit={handleEmailSubmit} noValidate>
            {mode === "register" && (
              <label className="block">
                <span className="sr-only">{t("login.nameLabel")}</span>
                <div className="relative">
                  <UserIcon
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("login.namePlaceholder")}
                    disabled={authInProgress}
                    className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)]/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
                  />
                </div>
              </label>
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
                  autoComplete={mode === "register" ? "email" : "username"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  required
                  disabled={authInProgress}
                  className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)]/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
                />
              </div>
            </label>

            <label className="block">
              <span className="sr-only">{t("login.passwordLabel")}</span>
              <div className="relative">
                <Lock
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("login.passwordPlaceholder", { min: String(PASSWORD_MIN_LENGTH) })}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  disabled={authInProgress}
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

            <button
              type="submit"
              disabled={authInProgress}
              className="gold-btn flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              {mode === "register" ? (
                <>
                  <UserPlus size={16} />
                  {t("login.signUp")}
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  {t("login.signIn")}
                </>
              )}
            </button>
          </form>

          <div className="pt-1 text-center text-xs text-[var(--text-secondary)]">
            {mode === "login" ? t("login.noAccount") : t("login.haveAccount")}{" "}
            <button
              type="button"
              onClick={switchMode}
              disabled={authInProgress}
              className="font-semibold text-[var(--accent)] hover:underline disabled:opacity-50"
            >
              {mode === "login" ? t("login.signUp") : t("login.signIn")}
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[0.05] pt-5 text-center">
          <button
            type="button"
            onClick={handleDemo}
            disabled={authInProgress}
            className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-50"
          >
            {t("login.tryDemo")}
          </button>
        </div>
      </div>
    </div>
  );
}
