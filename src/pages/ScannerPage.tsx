import { useState } from "react";
import { ScanLine, Sparkles, LoaderCircle, RefreshCcw } from "lucide-react";
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
    <div className="page-shell-tight space-y-8">
      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-5">
            <span className="page-kicker">
              <ScanLine size={14} />
              Buy Decision Engine
            </span>
            <div className="space-y-4">
              <h1 className="page-title">
                Сканер у магазині
                <br />
                для smarter покупки.
              </h1>
              <p className="page-copy">
                Швидко зрозумійте, чи справді нова річ підсилює ваш гардероб, чи просто
                дублює вже наявні сценарії.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="metric-pill">
              <Sparkles size={14} className="text-[var(--accent)]" />
              BUY / SKIP verdict
            </span>
            <span className="metric-pill">
              Cost-per-wear projection
            </span>
            <span className="metric-pill">
              Closet overlap analysis
            </span>
          </div>
        </div>
      </section>

      {!result && !loading && <CameraCapture onCapture={handleCapture} disabled={loading} />}

      {loading && (
        <section className="luxe-card flex flex-col items-center gap-5 p-8 text-center">
          {capturedImage && (
            <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-2">
              <img
                src={capturedImage}
                alt="Scanned item"
                className="h-72 w-auto rounded-[1.1rem] object-contain"
              />
            </div>
          )}
          <LoaderCircle size={28} className="animate-spin text-[var(--accent)]" />
          <div>
            <p className="text-lg font-semibold text-[var(--text-primary)]">Аналізуємо покупку</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Порівнюємо річ із поточним гардеробом та новими outfit-сценаріями.
            </p>
          </div>
        </section>
      )}

      {error && <div className="luxe-card border-[rgba(239,138,128,0.22)] p-4 text-sm text-[var(--danger)]">{error}</div>}

      {result && (
        <div className="space-y-5">
          {capturedImage && (
            <section className="luxe-card overflow-hidden p-4">
              <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
                <div className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-2">
                  <img
                    src={capturedImage}
                    alt="Scanned item"
                    className="h-full w-full rounded-[1rem] object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center gap-3 p-2">
                  <p className="section-subtitle">Captured Piece</p>
                  <h2 className="section-title">Fashion candidate ready for verdict</h2>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    Нижче ви бачите не просто рішення, а й контекст: дублювання, потенціал нових образів і очікувану реальну корисність речі.
                  </p>
                </div>
              </div>
            </section>
          )}

          <VerdictCard verdict={result.verdict} reasons={result.reasons} tags={result.tags} stats={result.stats} />

          <button
            type="button"
            onClick={handleReset}
            className="ghost-action inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
          >
            <RefreshCcw size={15} />
            Сканувати іншу річ
          </button>
        </div>
      )}
    </div>
  );
}
