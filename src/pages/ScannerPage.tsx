import { useState } from "react";
import { CameraCapture } from "../components/scanner/CameraCapture";
import { VerdictCard } from "../components/scanner/VerdictCard";

interface ScanResult {
  tags: {
    category: string;
    subcategory: string;
    colorPrimary: string;
    colorHex: string;
    pattern: string;
    fabric: string;
    formalityLevel: number;
    confidence: number;
  };
  verdict: "BUY" | "SKIP" | "CONSIDER";
  reasons: string[];
  stats: {
    sameCategoryCount: number;
    sameColorCount: number;
    samePatternCount: number;
    newOutfitPotential: number;
    projectedCostPerWear: string;
    avgWearsInWardrobe: number;
  };
}

export function ScannerPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async (base64: string, mimeType: string) => {
    setLoading(true);
    setError(null);
    setCapturedImage(`data:${mimeType};base64,${base64}`);

    try {
      const res = await fetch("/api/scanner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = (await res.json()) as ScanResult;
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setCapturedImage(null);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          In-Store Scanner
        </h1>
        <p className="mt-1 text-neutral-500">
          Photograph an item in store to get a BUY or SKIP verdict.
        </p>
      </div>

      {!result && !loading && (
        <CameraCapture onCapture={handleCapture} disabled={loading} />
      )}

      {loading && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-12">
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Scanned item"
              className="h-48 w-auto rounded-lg object-contain"
            />
          )}
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-neutral-600">Analyzing item...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {capturedImage && (
            <div className="flex justify-center">
              <img
                src={capturedImage}
                alt="Scanned item"
                className="h-48 w-auto rounded-lg object-contain shadow"
              />
            </div>
          )}

          <VerdictCard
            verdict={result.verdict}
            reasons={result.reasons}
            tags={result.tags}
            stats={result.stats}
          />

          <button
            onClick={handleReset}
            className="w-full rounded-xl border border-neutral-300 px-6 py-3 text-base font-medium
              text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Scan Another Item
          </button>
        </div>
      )}
    </div>
  );
}
