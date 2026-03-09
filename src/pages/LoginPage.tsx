import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getAppStatus } from "../services/api";

export function LoginPage() {
  const { loginWithGoogle, loginDemo, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  /* Fetch server config at runtime (not build-time env var) */
  useEffect(() => {
    getAppStatus()
      .then((status) => setGoogleClientId(status.googleClientId ?? null))
      .catch(() => setGoogleClientId(null))
      .finally(() => setStatusLoading(false));
  }, []);

  /* Redirect if already authenticated */
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  /* Google Sign-In callback */
  const handleGoogleResponse = useCallback(
    async (response: { credential: string }) => {
      await loginWithGoogle(response.credential);
      navigate("/", { replace: true });
    },
    [loginWithGoogle, navigate],
  );

  /* Load GSI script and render button */
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

  /* Demo login handler */
  const handleDemo = useCallback(async () => {
    await loginDemo();
    navigate("/", { replace: true });
  }, [loginDemo, navigate]);

  if (isLoading || statusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c9a55a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4">
      {/* Subtle radial gradient overlay */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,165,90,0.05)_0%,transparent_60%)]" />

      <div className="animate-fade-in-up relative w-full max-w-sm rounded-3xl border border-white/[0.06] bg-[#1a1a2e] p-8 shadow-2xl shadow-black/40">
        {/* Branding */}
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-wide text-[#c9a55a]">
            Pocket Stylist
          </h1>
          <p className="mt-2 text-sm text-[#f0ece4]/45">
            Ваш AI-асистент по гардеробу
          </p>
        </div>

        {/* Login options */}
        <div className="space-y-4">
          {googleClientId && (
            <div className="flex justify-center">
              <div ref={googleBtnRef} />
            </div>
          )}

          {/* Always show demo as fallback */}
          <button
            type="button"
            onClick={handleDemo}
            className={`w-full rounded-full px-4 py-3.5 text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#c9a55a]/40 focus:ring-offset-2 focus:ring-offset-[#1a1a2e] ${
              googleClientId
                ? "gold-ghost-btn"
                : "gold-btn"
            }`}
          >
            {googleClientId ? "Увійти як Demo" : "Увійти як Demo User"}
          </button>
        </div>

        {!googleClientId && (
          <p className="mt-8 text-center text-xs text-[#f0ece4]/25">
            Google Sign-In не налаштовано
          </p>
        )}
      </div>
    </div>
  );
}
