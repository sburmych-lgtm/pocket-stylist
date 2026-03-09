import { useState, useCallback } from "react";
import { ShareCard } from "../components/matching/ShareCard.js";
import { SharePreview } from "../components/matching/SharePreview.js";
import { shareImage, downloadBlob } from "../utils/share.js";
import { matchingApi } from "../services/api";
import type { MatchResult } from "../services/api";

type ShareState = "idle" | "generating" | "shared" | "downloaded";

export function MatchingPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Share state per recreation option index
  const [shareStates, setShareStates] = useState<Record<number, ShareState>>({});
  const [shareBlobs, setShareBlobs] = useState<Record<number, Blob>>({});
  const [activeShareIndex, setActiveShareIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState<number | null>(null);

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
      setShareStates({});
      setShareBlobs({});
      setActiveShareIndex(null);
      setShowPreview(null);

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const data = await matchingApi.analyze(base64, file.type);
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

  const handleShareClick = useCallback((optionIndex: number) => {
    setShareStates((prev) => ({ ...prev, [optionIndex]: "generating" }));
    setActiveShareIndex(optionIndex);
  }, []);

  const handleShareReady = useCallback(
    async (optionIndex: number, blob: Blob) => {
      setShareBlobs((prev) => ({ ...prev, [optionIndex]: blob }));
      try {
        const shared = await shareImage(blob, "My Style Match - Pocket Stylist");
        setShareStates((prev) => ({
          ...prev,
          [optionIndex]: shared ? "shared" : "downloaded",
        }));
      } catch {
        setShareStates((prev) => ({ ...prev, [optionIndex]: "idle" }));
      }
      setActiveShareIndex(null);
    },
    [],
  );

  const handleDownload = useCallback(
    (optionIndex: number) => {
      const blob = shareBlobs[optionIndex];
      if (!blob) {
        // Generate first, then download
        setShareStates((prev) => ({ ...prev, [optionIndex]: "generating" }));
        setActiveShareIndex(optionIndex);
        return;
      }
      downloadBlob(blob, "style-match.png");
      setShareStates((prev) => ({ ...prev, [optionIndex]: "downloaded" }));
    },
    [shareBlobs],
  );

  const shareButtonLabel = (state: ShareState): string => {
    switch (state) {
      case "generating":
        return "Створюю...";
      case "shared":
        return "Надіслано!";
      case "downloaded":
        return "Завантажено!";
      default:
        return "Поділитися";
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[#c9a55a]">
          Celebrity Match
        </h1>
        <p className="mt-1 text-sm text-[#f0ece4]/45">
          Завантажте фото будь-якого образу — ми відтворимо його з вашого гардеробу.
        </p>
      </div>

      {!result && !loading && (
        <div
          onClick={handleUpload}
          className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed
            border-[#c9a55a]/20 bg-[#1a1a2e] p-12 transition-all hover:border-[#c9a55a] hover:bg-[#c9a55a]/5 hover:shadow-[0_0_30px_rgba(201,165,90,0.08)]"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#c9a55a]/10">
            <span className="text-3xl">⭐</span>
          </div>
          <p className="text-lg font-medium text-[#f0ece4]/80">
            Завантажте фото-референс
          </p>
          <p className="text-sm text-[#f0ece4]/35">
            Аутфіт селебріті, вуличний стиль або будь-який образ
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#1a1a2e] p-12">
          {previewUrl && (
            <img src={previewUrl} alt="Reference" className="h-48 w-auto rounded-lg object-contain" />
          )}
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#c9a55a] border-t-transparent" />
            <span className="text-[#f0ece4]/45">Аналізую образ та шукаю відповідності...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      {result && (
        <div className="space-y-6">
          {previewUrl && (
            <div className="flex justify-center">
              <img src={previewUrl} alt="Reference" className="h-48 w-auto rounded-lg shadow-lg shadow-black/30" />
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#f0ece4]/35">
              Знайдені елементи
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.breakdown.map((g, i) => (
                <span key={i} className="rounded-full bg-white/[0.06] px-3 py-1 text-sm text-[#f0ece4]/70">
                  {g.color} {g.category} ({g.pattern})
                </span>
              ))}
            </div>
          </div>

          {result.recreations.length > 0 ? (
            result.recreations.map((option, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-[#f0ece4]">{option.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    option.overallScore >= 50 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {option.overallScore}% збіг
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {option.items.map((item) => (
                    <div key={item.id} className="flex-shrink-0 text-center">
                      <div className="h-28 w-22 overflow-hidden rounded-lg bg-white/[0.05]">
                        {item.imageUrl.startsWith("data:") ? (
                          <img src={item.imageUrl} alt={item.category} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#f0ece4]/35">
                            {item.category}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#f0ece4]/55">{item.subcategory ?? item.category}</p>
                      <p className="text-xs text-[#f0ece4]/35">{item.matchScore}% збіг</p>
                    </div>
                  ))}
                </div>

                {/* Share & Download buttons */}
                <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-3">
                  <button
                    onClick={() => {
                      if (shareStates[i] === "generating") return;
                      handleShareClick(i);
                    }}
                    disabled={shareStates[i] === "generating"}
                    className="gold-btn flex items-center gap-2 px-4 py-2 text-sm
                      disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {shareStates[i] === "generating" ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0f0f1a] border-t-transparent" />
                    ) : (
                      <span>📸</span>
                    )}
                    {shareButtonLabel(shareStates[i] ?? "idle")}
                  </button>

                  <button
                    onClick={() => handleDownload(i)}
                    disabled={shareStates[i] === "generating"}
                    className="gold-ghost-btn flex items-center gap-2 px-4 py-2 text-sm
                      disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>💾</span>
                    Завантажити
                  </button>

                  <button
                    onClick={() =>
                      setShowPreview((prev) => (prev === i ? null : i))
                    }
                    className="ml-auto text-sm text-[#c9a55a] hover:text-[#dbb978] transition-colors"
                  >
                    {showPreview === i ? "Сховати" : "Попередній перегляд"}
                  </button>
                </div>

                {/* Preview panel */}
                {showPreview === i && previewUrl && (
                  <div className="mt-4">
                    <SharePreview
                      referenceImageUrl={previewUrl}
                      recreationItems={option.items}
                      matchScore={option.overallScore}
                    />
                  </div>
                )}

                {/* Hidden ShareCard for canvas rendering */}
                {activeShareIndex === i && previewUrl && (
                  <ShareCard
                    referenceImageUrl={previewUrl}
                    recreationItems={option.items}
                    matchScore={option.overallScore}
                    onShare={(blob) => void handleShareReady(i, blob)}
                  />
                )}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-400">
              Відповідних речей не знайдено. Спробуйте імпортувати більше одягу!
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setPreviewUrl(null);
              setShareStates({});
              setShareBlobs({});
              setActiveShareIndex(null);
              setShowPreview(null);
            }}
            className="gold-ghost-btn w-full px-6 py-3 text-base"
          >
            Спробувати інше фото
          </button>
        </div>
      )}
    </div>
  );
}
