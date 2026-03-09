import { useState, useCallback } from "react";
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[#c9a55a]">
          {isMaleMode ? "Outfit Optimizer" : "Підібрати стиль"}
        </h1>
        <p className="mt-1 text-[#f0ece4]/45">
          {isMaleMode
            ? "Оберіть ситуацію — отримайте оптимальний аутфіт."
            : "Налаштуйте настрій і отримайте AI-поради щодо образу."}
        </p>
      </div>

      {/* Male mode: wardrobe efficiency stat */}
      {isMaleMode && result?.avgCostPerWear !== undefined && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <span className="text-lg">{"\uD83D\uDCB0"}</span>
          <span className="text-sm font-medium text-emerald-400">
            Ефективність гардеробу:{" "}
            <span className="text-base font-bold">
              {Math.round(result.avgCostPerWear)}%
            </span>
          </span>
        </div>
      )}

      <div className="space-y-6">
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
              onClick={handleGenerate}
              disabled={loading}
              className="gold-btn w-full px-6 py-3.5 text-base font-semibold disabled:opacity-50"
            >
              {loading ? "Генерую образи..." : "Підібрати образ"}
            </button>
          </>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && isMaleMode && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c9a55a] border-t-transparent" />
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <WeatherBadge
                temp={result.weather.temp}
                condition={result.weather.condition}
                location={result.weather.location}
              />
              {result.candidateCount !== undefined && (
                <p className="text-sm text-[#f0ece4]/45">
                  {result.candidateCount} речей відповідають критеріям
                </p>
              )}
            </div>

            {result.message && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-400">
                {result.message}
              </div>
            )}

            {result.outfits.length > 0 ? (
              <div className="space-y-4">
                {result.outfits.map((outfit, i) => (
                  <OutfitCard
                    key={i}
                    name={outfit.name}
                    items={outfit.items}
                    stylingTip={outfit.stylingTip}
                    confidence={outfit.confidence}
                  />
                ))}
              </div>
            ) : (
              !result.message && (
                <p className="text-center text-[#f0ece4]/45">
                  Не вдалося згенерувати образи. Спробуйте змінити настрій або додати більше речей.
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
