import { useState } from "react";
import { MoodSliders } from "../components/styling/MoodSliders";
import { OutfitCard } from "../components/styling/OutfitCard";
import { WeatherBadge } from "../components/styling/WeatherBadge";
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
}

export function StylingPage() {
  const [mood, setMood] = useState({ energy: 50, boldness: 50 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StylingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/styling/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });

      if (!res.ok) throw new Error("Failed to get suggestions");
      const data = (await res.json()) as StylingResponse;
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Style Me
        </h1>
        <p className="mt-1 text-neutral-500">
          Set your mood and get AI-powered outfit suggestions.
        </p>
      </div>

      <div className="space-y-6">
        <MoodSliders energy={mood.energy} boldness={mood.boldness} onChange={setMood} />

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold
            text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Generating outfits..." : "Get Outfit Suggestions"}
        </button>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
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
