import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/auth-context";
import { LanguageProvider, useI18n } from "./i18n";
import { HomePage } from "./pages/HomePage";
import { ImportPage } from "./pages/ImportPage";
import { StylingPage } from "./pages/StylingPage";
import { ScannerPage } from "./pages/ScannerPage";
import { MatchingPage } from "./pages/MatchingPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LookbookPage } from "./pages/LookbookPage";
import FamilyPage from "./pages/FamilyPage";
import { WardrobePage } from "./pages/WardrobePage";
import { LoginPage } from "./pages/LoginPage";
import { LegalPage } from "./pages/LegalPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

/* ---------- Protected route wrapper ---------- */

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RouteErrorFallback({ reset }: { reset: () => void }) {
  const { t } = useI18n();

  return (
    <section className="luxe-card mx-auto max-w-xl p-6 text-center">
      <p className="section-subtitle">{t("routeError.kicker")}</p>
      <h1 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
        {t("routeError.title")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        {t("routeError.description")}
      </p>
      <button type="button" onClick={reset} className="primary-action mt-5 px-5 py-3 text-sm">
        {t("routeError.retry")}
      </button>
    </section>
  );
}

/* ---------- App ---------- */

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/privacy"
              element={<LegalPage docPath="/privacy.md" titleKey="legal.privacyTitle" />}
            />
            <Route
              path="/terms"
              element={<LegalPage docPath="/terms.md" titleKey="legal.termsTitle" />}
            />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/wardrobe" element={<WardrobePage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route
                  path="/style"
                  element={(
                    <ErrorBoundary
                      scope="styling"
                      fallback={(_error, reset) => <RouteErrorFallback reset={reset} />}
                    >
                      <StylingPage />
                    </ErrorBoundary>
                  )}
                />
                <Route path="/scan" element={<ScannerPage />} />
                <Route path="/match" element={<MatchingPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/lookbook" element={<LookbookPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/family" element={<FamilyPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
