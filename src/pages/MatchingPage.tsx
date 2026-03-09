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

                {/* Share & Download buttons */}
                <div className="mt-4 flex items-center gap-3 border-t border-neutral-100 pt-3">
                  <button
                    onClick={() => {
                      if (shareStates[i] === "generating") return;
                      handleShareClick(i);
                    }}
                    disabled={shareStates[i] === "generating"}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm
                      font-medium text-white transition-colors hover:bg-indigo-700
                      disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {shareStates[i] === "generating" ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <span>{"📸"}</span>
                    )}
                    {shareButtonLabel(shareStates[i] ?? "idle")}
                  </button>

                  <button
                    onClick={() => handleDownload(i)}
                    disabled={shareStates[i] === "generating"}
                    className="flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2
                      text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50
                      disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{"💾"}</span>
                    Завантажити
                  </button>

                  <button
                    onClick={() =>
                      setShowPreview((prev) => (prev === i ? null : i))
                    }
                    className="ml-auto text-sm text-indigo-600 hover:text-indigo-700"
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
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
              No matching items found in your wardrobe. Try importing more clothes!
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
