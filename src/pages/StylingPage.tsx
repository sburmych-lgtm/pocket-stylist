import { useState, useCallback } from "react";
import { Sparkles, ArrowRight, BadgeCheck, LoaderCircle } from "lucide-react";
import { MoodSliders } from "../components/styling/MoodSliders";
import { ContextSelector } from "../components/styling/ContextSelector";
import { OutfitCard } from "../components/styling/OutfitCard";
import { WeatherBadge } from "../components/styling/WeatherBadge";
import { useAuth } from "../contexts/AuthContext";
import { stylingApi } from "../services/api";
import type { StylingResponse } from "../services/api";
import { useI18n } from "../i18n";

export function StylingPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isMaleMode = user?.genderMode === "male";

  const [mood, setMood] = useState({ energy: 50, boldness: 50 });
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StylingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(
    async (params: {
      energy: number;
      boldness: number;
      formalityMin?: number;
      formalityMax?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const data = await stylingApi.suggest({
          mood: { energy: params.energy, boldness: params.boldness },
          formalityMin: params.formalityMin,
          formalityMax: params.formalityMax,
        });
        setResult(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleContextSelect = useCallback(
    (preset: {
      key: string;
      energy: number;
      boldness: number;
      formalityMin: number;
      formalityMax: number;
    }) => {
      setSelectedContext(preset.key);
      void fetchSuggestions({
        energy: preset.energy,
        boldness: preset.boldness,
        formalityMin: preset.formalityMin,
        formalityMax: preset.formalityMax,
      });
    },
    [fetchSuggestions],
  );

  const handleGenerate = useCallback(() => {
    void fetchSuggestions({ energy: mood.energy, boldness: mood.boldness });
  }, [fetchSuggestions, mood]);

  return (
    <div className="page-shell space-y-8">
      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <span className="page-kicker">
              <Sparkles size={14} />
              {t("styling.kicker")}
            </span>
            <div className="space-y-4">
              <h1 className="page-title">
                {t(isMaleMode ? "styling.headingMale" : "styling.heading").split("\n").map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </h1>
              <p className="page-copy">
                {t(isMaleMode ? "styling.descriptionMale" : "styling.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="metric-pill">{t("styling.curatedOutfits")}</span>
              <span className="metric-pill">{t("styling.weatherAware")}</span>
              <span className="metric-pill">{t("styling.wardrobeBased")}</span>
            </div>
          </div>

          <div className="luxe-card flex flex-col gap-4 p-6">
            <p className="section-subtitle">{t("styling.studioNotes")}</p>
            <div className="space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <p>{t("styling.note1")}</p>
              <p>{t("styling.note2")}</p>
            </div>
            {isMaleMode && result?.avgCostPerWear !== undefined && (
              <div className="mt-auto rounded-[1.3rem] border border-[rgba(111,212,171,0.22)] bg-[rgba(111,212,171,0.08)] p-4">
                <p className="section-subtitle text-[var(--success)]">{t("styling.wardrobeEfficiency")}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
                  {Math.round(result.avgCostPerWear)}%
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {t("styling.efficiencyDesc")}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          {isMaleMode ? (
            <ContextSelector
              selected={selectedContext}
              loading={loading}
              onSelect={handleContextSelect}
            />
          ) : (
            <>
              <MoodSliders energy={mood.energy} boldness={mood.boldness} onChange={setMood} />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="primary-action inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm disabled:opacity-50"
              >
                {loading ? t("styling.generating") : t("styling.seeThreeOutfits")}
                <ArrowRight size={15} />
              </button>
            </>
          )}

          {error && (
            <div className="luxe-card border-[rgba(239,138,128,0.22)] p-4 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {loading && (
            <div className="luxe-card flex min-h-[22rem] flex-col items-center justify-center gap-4 p-10 text-center">
              <LoaderCircle size={28} className="animate-spin text-[var(--accent)]" />
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{t("styling.stylingLook")}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{t("styling.stylingDesc")}</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              <section className="luxe-card space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="section-subtitle">{t("styling.sessionResult")}</p>
                    <h2 className="section-title mt-2">{t("styling.todaysBrief")}</h2>
                  </div>
                  {result.candidateCount !== undefined && (
                    <span className="status-chip bg-[rgba(201,165,90,0.12)] text-[var(--accent)]">
                      <BadgeCheck size={12} />
                      {t("styling.itemsInPlay", { count: result.candidateCount })}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <WeatherBadge
                    temp={result.weather.temp}
                    condition={result.weather.condition}
                    location={result.weather.location}
                  />
                  {result.message && (
                    <div className="rounded-full border border-[rgba(241,195,121,0.22)] bg-[rgba(241,195,121,0.08)] px-4 py-3 text-sm text-[var(--warning)]">
                      {result.message}
                    </div>
                  )}
                </div>
              </section>

              {result.outfits.length > 0 ? (
                <div className="space-y-5">
                  {result.outfits.map((outfit, index) => (
                    <OutfitCard
                      key={index}
                      name={outfit.name}
                      items={outfit.items}
                      stylingTip={outfit.stylingTip}
                      confidence={outfit.confidence}
                    />
                  ))}
                </div>
              ) : (
                !result.message && (
                  <div className="luxe-card p-8 text-center">
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{t("styling.noOutfit")}</p>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{t("styling.noOutfitHint")}</p>
                  </div>
                )
              )}
            </>
          )}

          {!result && !loading && (
            <div className="luxe-card p-8">
              <p className="section-subtitle">{t("styling.studioPrompt")}</p>
              <h2 className="section-title mt-2">{t("styling.promptTitle")}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                {t("styling.promptDesc")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
