import { useState } from "react";
import { CameraCapture } from "../components/scanner/CameraCapture";
import { VerdictCard } from "../components/scanner/VerdictCard";
import { scannerApi } from "../services/api";
import type { ScanResult } from "../services/api";

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
      const data = await scannerApi.analyze(base64, mimeType);
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
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[#c9a55a]">
          Сканер у магазині
        </h1>
        <p className="mt-1 text-[#f0ece4]/45">
          Сфотографуйте річ у магазині — отримайте вердикт BUY або SKIP.
        </p>
      </div>

      {!result && !loading && (
        <CameraCapture onCapture={handleCapture} disabled={loading} />
      )}

      {loading && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#1a1a2e] p-12">
          {capturedImage && (
            <img src={capturedImage} alt="Scanned item"
              className="h-48 w-auto rounded-lg object-contain" />
          )}
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#c9a55a] border-t-transparent" />
            <span className="text-[#f0ece4]/55">Аналізую річ...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {capturedImage && (
            <div className="flex justify-center">
              <img src={capturedImage} alt="Scanned item"
                className="h-48 w-auto rounded-lg object-contain shadow-xl shadow-black/30" />
            </div>
          )}
          <VerdictCard verdict={result.verdict} reasons={result.reasons} tags={result.tags} stats={result.stats} />
          <button onClick={handleReset}
            className="gold-ghost-btn w-full px-6 py-3.5 text-base">
            Сканувати іншу річ
          </button>
        </div>
      )}
    </div>
  );
}
