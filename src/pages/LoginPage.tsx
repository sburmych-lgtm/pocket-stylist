import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

export function LoginPage() {
  const { loginWithGoogle, loginDemo, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const googleBtnRef = useRef<HTMLDivElement>(null);

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
    if (!GOOGLE_CLIENT_ID) return;

    function initGsi() {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
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
  }, [handleGoogleResponse]);

  /* Demo login handler */
  const handleDemo = useCallback(async () => {
    await loginDemo();
    navigate("/", { replace: true });
  }, [loginDemo, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Pocket Stylist
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your AI wardrobe assistant
          </p>
        </div>

        {/* Login options */}
        <div className="space-y-4">
          {GOOGLE_CLIENT_ID ? (
            <div className="flex justify-center">
              <div ref={googleBtnRef} />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDemo}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Continue as Demo User
            </button>
          )}
        </div>

        {/* Footer hint */}
        {!GOOGLE_CLIENT_ID && (
          <p className="mt-6 text-center text-xs text-neutral-400">
            Demo mode — no Google Client ID configured
          </p>
        )}
      </div>
    </div>
  );
}
