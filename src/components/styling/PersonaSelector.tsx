import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../i18n";
import { profileApi } from "../../services/api";
import type { StylistPersona, UserProfile } from "../../services/api";

interface PersonaOption {
  key: StylistPersona;
  emoji: string;
  nameKey: string;
  descKey: string;
  quoteKey: string;
}

// Order is intentional — neutral first, then the three flavored voices.
const PERSONA_OPTIONS: PersonaOption[] = [
  { key: "classic", emoji: "🎩", nameKey: "profile.personaClassic", descKey: "profile.personaClassicDesc", quoteKey: "profile.personaClassicQuote" },
  { key: "sassy", emoji: "💅", nameKey: "profile.personaSassy", descKey: "profile.personaSassyDesc", quoteKey: "profile.personaSassyQuote" },
  { key: "manly", emoji: "💪", nameKey: "profile.personaManly", descKey: "profile.personaManlyDesc", quoteKey: "profile.personaManlyQuote" },
  { key: "kind", emoji: "🤱", nameKey: "profile.personaKind", descKey: "profile.personaKindDesc", quoteKey: "profile.personaKindQuote" },
];

interface PersonaSelectorProps {
  current: StylistPersona;
}

export function PersonaSelector({ current }: PersonaSelectorProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Optimistic update: flip the local cache the moment the user clicks,
  // roll back on failure so the UI never gets stuck on a stale persona.
  const mutation = useMutation({
    mutationFn: (persona: StylistPersona) => profileApi.updatePersona(persona),
    onMutate: async (persona) => {
      await queryClient.cancelQueries({ queryKey: ["profile"] });
      const previous = queryClient.getQueryData<UserProfile>(["profile"]);
      if (previous) {
        queryClient.setQueryData<UserProfile>(["profile"], { ...previous, stylistPersona: persona });
      }
      return { previous };
    },
    onError: (_err, _persona, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["profile"], ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  return (
    <section
      className="rounded-2xl border border-white/[0.06] bg-[#1a1a2e] p-6"
      aria-labelledby="persona-section-title"
    >
      <div className="mb-5">
        <h2
          id="persona-section-title"
          className="text-lg font-semibold text-[#f0ece4]"
        >
          {t("profile.personaSection")}
        </h2>
        <p className="mt-1.5 text-sm text-[#f0ece4]/55">
          {t("profile.personaSectionDesc")}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={t("profile.personaSection")}
        className="grid gap-3 sm:grid-cols-2"
      >
        {PERSONA_OPTIONS.map((opt) => {
          const isSelected = current === opt.key;
          const isDisabled = mutation.isPending;

          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isDisabled}
              onClick={() => {
                if (!isSelected) mutation.mutate(opt.key);
              }}
              className={[
                "flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                "disabled:cursor-wait disabled:opacity-70",
                isSelected
                  ? "border-[#c9a55a]/60 bg-[#c9a55a]/10 ring-1 ring-[#c9a55a]/40"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.05]",
              ].join(" ")}
            >
              <div className="flex w-full items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0f0f1a] text-2xl"
                  aria-hidden="true"
                >
                  {opt.emoji}
                </span>
                <div className="flex-1">
                  <h3
                    className={`text-base font-semibold ${
                      isSelected ? "text-[#c9a55a]" : "text-[#f0ece4]"
                    }`}
                  >
                    {t(opt.nameKey)}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#f0ece4]/55">
                    {t(opt.descKey)}
                  </p>
                </div>
              </div>
              <div className="w-full rounded-lg bg-black/30 p-3">
                <p className="text-[0.7rem] uppercase tracking-wider text-[#f0ece4]/35">
                  {t("profile.personaSampleLabel")}
                </p>
                <p className="mt-1 text-sm italic text-[#f0ece4]/75">
                  &ldquo;{t(opt.quoteKey)}&rdquo;
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-400">{t("profile.personaError")}</p>
      )}
    </section>
  );
}
