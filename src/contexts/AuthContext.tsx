import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  authApi,
  setToken,
  clearToken,
  getToken,
} from "../services/api";
import type { AuthUser } from "../services/api";

/* ---------- Types ---------- */

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
}

/* ---------- Context ---------- */

const AuthContext = createContext<AuthContextType | null>(null);

/* ---------- Hook ---------- */

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/* ---------- Provider ---------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  /* --- helpers --- */

  const handleAuthResponse = useCallback(
    (data: { token: string; user: AuthUser }) => {
      setToken(data.token);
      setTokenState(data.token);
      setUser(data.user);
    },
    [],
  );

  /* --- login methods --- */

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const data = await authApi.loginGoogle(credential);
      handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.loginEmail(email, password);
      handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      const data = await authApi.registerEmail(email, password, name);
      handleAuthResponse(data);
    },
    [handleAuthResponse],
  );

  const loginDemo = useCallback(async () => {
    const data = await authApi.loginDemo();
    setIsDemoMode(true);
    handleAuthResponse(data);
  }, [handleAuthResponse]);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setIsDemoMode(false);
  }, []);

  /* --- init: verify existing token or auto-demo --- */

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Check for token from redirect-based OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const callbackToken = urlParams.get("token") ?? hashParams.get("token");
      if (callbackToken) {
        window.history.replaceState({}, "", window.location.pathname);
        setToken(callbackToken);
        setTokenState(callbackToken);
        try {
          const me = await authApi.getMe();
          if (!cancelled) {
            setUser(me);
            setIsLoading(false);
          }
        } catch {
          clearToken();
          setTokenState(null);
        }
        if (!cancelled) setIsLoading(false);
        return;
      }

      const existing = getToken();

      if (existing) {
        try {
          const me = await authApi.getMe();
          if (!cancelled) {
            setUser(me);
          }
        } catch {
          // token invalid — clear it
          clearToken();
          setTokenState(null);
        }
      }

      // No auto-demo — user must explicitly choose how to log in (Google, email, or demo)
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [handleAuthResponse]);

  /* --- context value --- */

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: user !== null,
      isDemoMode,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      loginDemo,
      logout,
    }),
    [
      user,
      token,
      isLoading,
      isDemoMode,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      loginDemo,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
