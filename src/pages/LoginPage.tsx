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
      await loginWithGoogle(response.credential);
      navigate("/", { replace: true });
    },
    [loginWithGoogle, navigate],
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
    await loginDemo();
    navigate("/", { replace: true });
  }, [loginDemo, navigate]);

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
          {googleClientId && (
            <div className="flex justify-center">
              <div ref={googleBtnRef} />
            </div>
          )}

          <button
            type="button"
            onClick={handleDemo}
            className={`w-full rounded-full px-4 py-3.5 text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)] ${
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
