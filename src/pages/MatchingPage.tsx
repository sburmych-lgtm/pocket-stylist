import { useState, useCallback } from "react";

interface GarmentTarget {
  category: string;
  color: string;
  pattern: string;
  description: string;
}

interface RecreationOption {
  name: string;
  items: Array<{
    id: string;
    category: string;
    colorPrimary: string;
    imageUrl: string;
    thumbnailUrl: string | null;
    subcategory: string | null;
    matchScore: number;
  }>;
  overallScore: number;
}

interface MatchResult {
  breakdown: GarmentTarget[];
  recreations: RecreationOption[];
}

export function MatchingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setPreviewUrl(URL.createObjectURL(file));
      setLoading(true);
      setError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch("/api/matching/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64, mimeType: file.type }),
          });
          if (!res.ok) throw new Error("Analysis failed");
          const data = (await res.json()) as MatchResult;
          setResult(data);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Celebrity Match
        </h1>
        <p className="mt-1 text-neutral-500">
          Upload any outfit photo — we'll recreate the look from your wardrobe.
        </p>
      </div>

      {!result && !loading && (
        <div
          onClick={handleUpload}
          className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed
            border-neutral-300 bg-white p-12 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
        >
          <div className="text-5xl">{"\u2B50"}</div>
          <p className="text-lg font-medium text-neutral-700">
            Upload a reference photo
          </p>
          <p className="text-sm text-neutral-500">
            Celebrity outfit, street style, or any look you want to recreate
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-12">
          {previewUrl && (
            <img src={previewUrl} alt="Reference" className="h-48 w-auto rounded-lg object-contain" />
          )}
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-neutral-600">Analyzing outfit & finding matches...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="space-y-6">
          {previewUrl && (
            <div className="flex justify-center">
              <img src={previewUrl} alt="Reference" className="h-48 w-auto rounded-lg shadow" />
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Detected Garments
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.breakdown.map((g, i) => (
                <span key={i} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
                  {g.color} {g.category} ({g.pattern})
                </span>
              ))}
            </div>
          </div>

          {result.recreations.length > 0 ? (
            result.recreations.map((option, i) => (
              <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-800">{option.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    option.overallScore >= 50 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {option.overallScore}% match
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {option.items.map((item) => (
                    <div key={item.id} className="flex-shrink-0 text-center">
                      <div className="h-28 w-22 overflow-hidden rounded-lg bg-neutral-100">
                        {item.imageUrl.startsWith("data:") ? (
                          <img src={item.imageUrl} alt={item.category} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                            {item.category}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">{item.subcategory ?? item.category}</p>
                      <p className="text-xs text-neutral-400">{item.matchScore}% match</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
              No matching items found in your wardrobe. Try importing more clothes!
            </div>
          )}

          <button
            onClick={() => { setResult(null); setPreviewUrl(null); }}
            className="w-full rounded-xl border border-neutral-300 px-6 py-3 text-base font-medium
              text-neutral-700 hover:bg-neutral-50"
          >
            Try Another Photo
          </button>
        </div>
      )}
    </div>
  );
}
