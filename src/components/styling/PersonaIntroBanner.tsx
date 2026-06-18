import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../i18n";
import { profileApi } from "../../services/api";
import type { UserProfile } from "../../services/api";

const STORAGE_KEY = "persona_intro_seen";

function readDismissedFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage disabled (private mode, SSR) — treat as "seen" so we
    // never pester users we can't remember dismissals for.
    return true;
  }
}

/**
 * Onboarding nudge shown on the styling page the first time a user lands
 * there with the default persona. Lets them know the bot has a voice they
 * can pick. Hides after dismissal (localStorage) or once they switch away
 * from "classic" — no point pestering someone who already chose.
 */
export function PersonaIntroBanner() {
  const { t } = useI18n();
  // Lazy initializer reads localStorage once on mount without triggering
  // the React 19 "no setState in effect" lint rule.
  const [dismissed, setDismissed] = useState<boolean>(readDismissedFromStorage);

  // Reuse the cached profile query — no extra round-trip when the page
  // header or selector already populated it.
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: profileApi.getProfile,
    staleTime: 30_000,
  });

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — UI hides regardless
    }
    setDismissed(true);
  };

  // Only nudge users still on the default voice. Anyone who already chose
  // shouldn't see "pick your stylist" again.
  if (dismissed) return null;
  if (profile && profile.stylistPersona !== "classic") return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#c9a55a]/30 bg-gradient-to-r from-[#c9a55a]/10 via-[#1a1a2e] to-[#1a1a2e] p-5">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("profile.personaIntroDismiss")}
        className="absolute right-3 top-3 rounded-full p-1.5 text-[#f0ece4]/55 hover:bg-white/[0.06] hover:text-[#f0ece4]"
      >
        <X size={16} />
      </button>

      <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c9a55a]/15 text-[#c9a55a]"
            aria-hidden="true"
          >
            <Sparkles size={18} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-[#f0ece4]">
              {t("profile.personaIntroBanner")}
            </h3>
            <p className="mt-1 text-sm text-[#f0ece4]/55">
              {t("profile.personaIntroDesc")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg px-3 py-2 text-sm text-[#f0ece4]/55 hover:bg-white/[0.05]"
          >
            {t("profile.personaIntroDismiss")}
          </button>
          <Link
            to="/profile"
            onClick={handleDismiss}
            className="rounded-lg bg-[#c9a55a] px-4 py-2 text-sm font-medium text-[#0f0f1a] hover:bg-[#d4b46b]"
          >
            {t("profile.personaIntroCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
