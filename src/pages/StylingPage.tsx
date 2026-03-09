import { useState, useCallback } from "react";
import { Sparkles, ArrowRight, BadgeCheck, LoaderCircle } from "lucide-react";
import { MoodSliders } from "../components/styling/MoodSliders";
import { ContextSelector } from "../components/styling/ContextSelector";
import { OutfitCard } from "../components/styling/OutfitCard";
import { WeatherBadge } from "../components/styling/WeatherBadge";
import { useAuth } from "../contexts/AuthContext";
import { stylingApi } from "../services/api";
import type { StylingResponse } from "../services/api";

export function StylingPage() {
  const { user } = useAuth();
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
              AI Styling Studio
            </span>
            <div className="space-y-4">
              <h1 className="page-title">
                {isMaleMode ? "Outfit optimizer" : "Style Me"}
                <br />
                для реального життя.
              </h1>
              <p className="page-copy">
                {isMaleMode
                  ? "Обирайте ситуацію, а ми дамо зібраний, практичний і дорогий на вигляд look."
                  : "Працюємо як персональний fashion-консультант: зчитуємо настрій, погоду і складаємо три образи."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="metric-pill">
                3 curated outfits
              </span>
              <span className="metric-pill">
                Weather-aware
              </span>
              <span className="metric-pill">
                Wardrobe-based
              </span>
            </div>
          </div>

          <div className="luxe-card flex flex-col gap-4 p-6">
            <p className="section-subtitle">Studio Notes</p>
            <div className="space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <p>
                Ми не просто комбінуємо речі. Ми шукаємо look з правильним балансом
                пропорцій, формальності та настрою.
              </p>
              <p>
                Чим якісніше протегований гардероб, тим точніше AI розпізнає стильові
                можливості речей.
              </p>
            </div>
            {isMaleMode && result?.avgCostPerWear !== undefined && (
              <div className="mt-auto rounded-[1.3rem] border border-[rgba(111,212,171,0.22)] bg-[rgba(111,212,171,0.08)] p-4">
                <p className="section-subtitle text-[var(--success)]">Wardrobe Efficiency</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
                  {Math.round(result.avgCostPerWear)}%
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Ваш гардероб уже видає сильні practical combinations.
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
                {loading ? "Генеруємо образи..." : "Побачити три образи"}
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
                <p className="text-lg font-semibold text-[var(--text-primary)]">Стилізуємо ваш look</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Аналізуємо настрій, wardrobe-coverage та погодний контекст.
                </p>
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              <section className="luxe-card space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="section-subtitle">Session Result</p>
                    <h2 className="section-title mt-2">Ваш сьогоднішній fashion brief</h2>
                  </div>
                  {result.candidateCount !== undefined && (
                    <span className="status-chip bg-[rgba(214,177,111,0.12)] text-[var(--accent)]">
                      <BadgeCheck size={12} />
                      {result.candidateCount} речей у грі
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
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                      Поки не вдалося скласти сильний образ.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                      Спробуйте інший настрій, змініть контекст або поповніть гардероб новими речами.
                    </p>
                  </div>
                )
              )}
            </>
          )}

          {!result && !loading && (
            <div className="luxe-card p-8">
              <p className="section-subtitle">Studio Prompt</p>
              <h2 className="section-title mt-2">Сформуйте запит і ми покажемо три образи</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                Почніть із настрою або пресету контексту. Далі система збере ready-to-wear
                комбінації, які виглядають цілісно й працюють у реальному гардеробі.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
