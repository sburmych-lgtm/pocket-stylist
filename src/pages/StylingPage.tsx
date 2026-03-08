import { useState, useCallback } from "react";
import { MoodSliders } from "../components/styling/MoodSliders";
import { ContextSelector } from "../components/styling/ContextSelector";
import { OutfitCard } from "../components/styling/OutfitCard";
import { WeatherBadge } from "../components/styling/WeatherBadge";
import { useAuth } from "../contexts/AuthContext";
import type { WardrobeItem } from "../types/wardrobe";

interface OutfitSuggestion {
  name: string;
  items: WardrobeItem[];
  stylingTip: string;
  confidence: number;
}

interface StylingResponse {
  outfits: OutfitSuggestion[];
  weather: {
    temp: number;
    condition: string;
    location: string;
  };
  candidateCount?: number;
  message?: string;
  avgCostPerWear?: number;
}

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
        const res = await fetch("/api/styling/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mood: { energy: params.energy, boldness: params.boldness },
            formalityMin: params.formalityMin,
            formalityMax: params.formalityMax,
          }),
        });

        if (!res.ok) throw new Error("Failed to get suggestions");
        const data = (await res.json()) as StylingResponse;
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
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {isMaleMode ? "Outfit Optimizer" : "Style Me"}
        </h1>
        <p className="mt-1 text-neutral-500">
          {isMaleMode
            ? "Оберіть ситуацію — отримайте оптимальний аутфіт."
            : "Set your mood and get AI-powered outfit suggestions."}
        </p>
      </div>

      {/* Male mode: wardrobe efficiency stat */}
      {isMaleMode && result?.avgCostPerWear !== undefined && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-lg">{"\uD83D\uDCB0"}</span>
          <span className="text-sm font-medium text-emerald-800">
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
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold
                text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Generating outfits..." : "Get Outfit Suggestions"}
            </button>
          </>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && isMaleMode && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
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
                <p className="text-sm text-neutral-500">
                  {result.candidateCount} items matched your criteria
                </p>
              )}
            </div>

            {result.message && (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
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
                <p className="text-center text-neutral-500">
                  No outfits could be generated. Try adjusting your mood or adding more items.
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
