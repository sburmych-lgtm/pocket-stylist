import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAppStatus } from "../services/api";
import { useI18n } from "../i18n";

export function LoginPage() {
  const { loginWithGoogle, loginDemo, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInProgress, setAuthInProgress] = useState(false);

  // Pick up authError from redirect callback URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectError = params.get("authError");
    if (redirectError) {
      window.history.replaceState({}, "", window.location.pathname);
      setAuthError(t("login.authError"));
    }
  }, [t]);

  useEffect(() => {
    getAppStatus()
      .then((status) => setGoogleClientId(status.googleClientId ?? null))
      .catch(() => setGoogleClientId(null))
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleGoogleResponse = useCallback(
    async (response: { credential: string }) => {
      setAuthError(null);
      setAuthInProgress(true);
      try {
        await loginWithGoogle(response.credential);
        navigate("/", { replace: true });
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : t("login.authError"),
        );
      } finally {
        setAuthInProgress(false);
      }
    },
    [loginWithGoogle, navigate, t],
  );

  useEffect(() => {
    if (!googleClientId) return;

    function initGsi() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId!,
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_black",
        size: "large",
        width: 320,
      });
    }

    if (window.google) {
      initGsi();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGsi;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [googleClientId, handleGoogleResponse]);

  const handleDemo = useCallback(async () => {
    setAuthError(null);
    setAuthInProgress(true);
    try {
      await loginDemo();
      navigate("/", { replace: true });
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : t("login.authError"),
      );
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,165,90,0.05)_0%,transparent_60%)]" />

      <div className="animate-fade-in-up relative w-full max-w-sm rounded-3xl border border-white/[0.06] bg-[var(--bg-surface)] p-8 shadow-2xl shadow-black/40">
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-wide text-[var(--accent)]">
            {t("brand.name")}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t("login.subtitle")}
          </p>
        </div>

        <div className="space-y-4">
          {authError && (
            <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-4 py-3 text-center text-sm text-[var(--danger)]">
              {authError}
            </div>
          )}

          {authInProgress && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--text-secondary)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              {t("login.signingIn")}
            </div>
          )}

          {googleClientId && !authInProgress && (
            <div className="flex justify-center">
              <div ref={googleBtnRef} />
            </div>
          )}

          {googleClientId && !authInProgress && (
            <a
              href="/api/auth/google/redirect"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold text-[var(--text-primary)] transition-all duration-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("login.googleRedirect")}
            </a>
          )}

          <button
            type="button"
            onClick={handleDemo}
            disabled={authInProgress}
            className={`w-full rounded-full px-4 py-3.5 text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)] disabled:opacity-50 ${
              googleClientId
                ? "gold-ghost-btn"
                : "gold-btn"
            }`}
          >
            {googleClientId ? t("login.demoLogin") : t("login.demoLoginFull")}
          </button>
        </div>

        {!googleClientId && (
          <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
            {t("login.googleNotConfigured")}
          </p>
        )}
      </div>
    </div>
  );
}
