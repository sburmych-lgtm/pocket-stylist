import { useState, useCallback } from "react";
import { Download, Eye, LoaderCircle, RefreshCcw, Share2, Sparkles, Star } from "lucide-react";
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
      if (!file) {
        return;
      }

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

  const handleShareReady = useCallback(async (optionIndex: number, blob: Blob) => {
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
  }, []);

  const handleDownload = useCallback(
    (optionIndex: number) => {
      const blob = shareBlobs[optionIndex];
      if (!blob) {
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
        return "Генерую...";
      case "shared":
        return "Надіслано!";
      case "downloaded":
        return "Збережено!";
      default:
        return "Поділитися";
    }
  };

  return (
    <div className="page-shell-tight space-y-8">
      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <span className="page-kicker">
              <Star size={14} />
              Celebrity Match
            </span>
            <h1 className="page-title">
              Відтворіть чужий look
              <br />
              зі свого гардеробу.
            </h1>
            <p className="page-copy">
              Завантажте референс із селебріті, street style чи editorial-shoot, а ми
              підберемо найближчі речі з вашої шафи й побудуємо share-ready poster.
            </p>
          </div>

          <div className="luxe-card p-6">
            <p className="section-subtitle">How it works</p>
            <div className="mt-5 space-y-3">
              {[
                "Зчитуємо категорії, кольори, патерни та пропорції референсу.",
                "Шукаємо найсильніші збіги в реальному гардеробі.",
                "Показуємо кілька recreation options і готуємо share-постер.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!result && !loading && (
        <section className="page-header p-6 sm:p-8">
          <div
            onClick={handleUpload}
            className="relative z-10 flex cursor-pointer flex-col items-center gap-5 rounded-[1.8rem] border border-dashed border-[rgba(214,177,111,0.28)] bg-[rgba(255,255,255,0.03)] px-8 py-14 text-center transition-all hover:border-[rgba(214,177,111,0.46)] hover:bg-[rgba(214,177,111,0.05)]"
          >
            <div className="spotlight-ring flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(214,177,111,0.12)] text-[var(--accent)]">
              <Sparkles size={32} />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
                Завантажте фото-референс
              </h2>
              <p className="mx-auto max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                Це може бути celebrity outfit, fashion-week street style або будь-який образ,
                який ви хочете recreate зі своєї капсули.
              </p>
            </div>
            <div className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
              Обрати референс
            </div>
          </div>
        </section>
      )}

      {loading && (
        <section className="luxe-card flex flex-col items-center gap-5 p-8 text-center">
          {previewUrl && (
            <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-2">
              <img src={previewUrl} alt="Reference" className="h-80 w-auto rounded-[1rem] object-contain" />
            </div>
          )}
          <LoaderCircle size={28} className="animate-spin text-[var(--accent)]" />
          <div>
            <p className="text-lg font-semibold text-[var(--text-primary)]">Шукаємо найкращі збіги</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Аналізуємо референс і звіряємо його з вашим wardrobe inventory.
            </p>
          </div>
        </section>
      )}

      {error && <div className="luxe-card border-[rgba(239,138,128,0.22)] p-4 text-sm text-[var(--danger)]">{error}</div>}

      {result && (
        <div className="space-y-6">
          {previewUrl && (
            <section className="luxe-card p-4 sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
                <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-2">
                  <img src={previewUrl} alt="Reference" className="aspect-[4/5] w-full rounded-[1rem] object-cover" />
                </div>

                <div className="space-y-5 p-1">
                  <div>
                    <p className="section-subtitle">Decoded Reference</p>
                    <h2 className="section-title mt-2">AI зчитав структуру образу</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.breakdown.map((group, index) => (
                      <span key={`${group.category}-${index}`} className="metric-pill">
                        {group.color} {group.category} · {group.pattern}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {result.recreations.length > 0 ? (
            <div className="space-y-5">
              {result.recreations.map((option, index) => (
                <article key={index} className="luxe-card p-5 sm:p-6">
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="page-kicker">Recreation Option</span>
                          <h3 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">
                            {option.name}
                          </h3>
                        </div>
                        <span
                          className={[
                            "status-chip",
                            option.overallScore >= 50
                              ? "bg-[rgba(111,212,171,0.12)] text-[var(--success)]"
                              : "bg-[rgba(241,195,121,0.12)] text-[var(--warning)]",
                          ].join(" ")}
                        >
                          {option.overallScore}% match
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {option.items.map((item) => (
                          <div
                            key={item.id}
                            className="overflow-hidden rounded-[1.3rem] border border-white/8 bg-white/[0.03]"
                          >
                            <div className="aspect-[4/5] overflow-hidden">
                              {item.imageUrl.startsWith("data:") || item.imageUrl.startsWith("http") ? (
                                <img src={item.imageUrl} alt={item.category} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">
                                  {item.category}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1 px-4 py-3">
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {item.subcategory ?? item.category}
                              </p>
                              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                {item.matchScore}% match
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-5">
                        <p className="section-subtitle">Share Tools</p>
                        <h4 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                          Створіть social-ready poster
                        </h4>
                        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                          Генеруємо візуальний board зі score, reference image і вашою recreation-комбінацією.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (shareStates[index] === "generating") {
                                return;
                              }
                              handleShareClick(index);
                            }}
                            disabled={shareStates[index] === "generating"}
                            className="primary-action inline-flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
                          >
                            {shareStates[index] === "generating" ? (
                              <LoaderCircle size={15} className="animate-spin" />
                            ) : (
                              <Share2 size={15} />
                            )}
                            {shareButtonLabel(shareStates[index] ?? "idle")}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(index)}
                            disabled={shareStates[index] === "generating"}
                            className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
                          >
                            <Download size={15} />
                            Завантажити
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowPreview((prev) => (prev === index ? null : index))}
                            className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm"
                          >
                            <Eye size={15} />
                            {showPreview === index ? "Сховати preview" : "Попередній перегляд"}
                          </button>
                        </div>
                      </div>

                      {showPreview === index && previewUrl && (
                        <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                          <SharePreview
                            referenceImageUrl={previewUrl}
                            recreationItems={option.items}
                            matchScore={option.overallScore}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {activeShareIndex === index && previewUrl && (
                    <div className="mt-4">
                      <ShareCard
                        referenceImageUrl={previewUrl}
                        recreationItems={option.items}
                        matchScore={option.overallScore}
                        onShare={(blob) => void handleShareReady(index, blob)}
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="luxe-card border-[rgba(241,195,121,0.22)] p-6 text-sm text-[var(--warning)]">
              Відповідних речей не знайдено. Спробуйте імпортувати більше одягу, щоб recreation-пошук став точнішим.
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setResult(null);
              setPreviewUrl(null);
              setShareStates({});
              setShareBlobs({});
              setActiveShareIndex(null);
              setShowPreview(null);
            }}
            className="ghost-action inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm"
          >
            <RefreshCcw size={15} />
            Спробувати інший референс
          </button>
        </div>
      )}
    </div>
  );
}
