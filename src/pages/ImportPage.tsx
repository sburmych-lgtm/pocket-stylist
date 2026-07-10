import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layers,
  ArrowRight,
  LoaderCircle,
  BadgeCheck,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { DropZone } from "../components/import/DropZone";
import { ingestImage } from "../services/api";
import { compressImageToBase64 } from "../utils/imageCompress";
import { useI18n } from "../i18n";

let nextId = 0;
const IMPORT_CONCURRENCY = Math.max(1, Number(import.meta.env.VITE_IMPORT_CONCURRENCY ?? 1));

// Direct-ingest item shape — discriminated by status. There is no longer a
// "needs save" middle state; once status === "done" the item is already
// persisted in the wardrobe.
type Stage =
  | { status: "queued"; previewUrl: string; fileName: string; id: string }
  | { status: "uploading"; previewUrl: string; fileName: string; id: string }
  | { status: "analyzing"; previewUrl: string; fileName: string; id: string }
  | {
      status: "done";
      previewUrl: string;
      fileName: string;
      id: string;
      itemId: string;
      category: string;
      colorPrimary: string;
      confidence: number;
      needsReview: boolean;
      reviewReasons: string[];
      reviewSeverity?: "ok" | "suggestion" | "critical";
      analysisStatus?: "ok" | "partial" | "failed";
    }
  | {
      status: "error";
      previewUrl: string;
      fileName: string;
      id: string;
      error: string;
    };

function mapErrorCode(message: string, t: (k: string) => string): string {
  if (message === "HEIC_LOADER_UNAVAILABLE") return t("import.errors.heicLoader");
  if (message === "HEIC_CONVERSION_FAILED") return t("import.errors.heicConvert");
  if (/network|fetch/i.test(message)) return t("import.errors.network");
  return message || t("common.error");
}

export function ImportPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState<Stage[]>([]);

  const processFile = useCallback(
    async (file: File, id: string) => {
      try {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "uploading" } : it)),
        );

        const base64 = await compressImageToBase64(file);

        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: "analyzing" } : it)),
        );

        const result = await ingestImage(base64, "image/jpeg", file.name);

        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  status: "done",
                  previewUrl: it.previewUrl,
                  fileName: it.fileName,
                  id: it.id,
                  itemId: result.id,
                  category: result.tags.category,
                  colorPrimary: result.tags.colorPrimary,
                  confidence: result.tags.confidence,
                  needsReview: result.needsReview === true || result.tags.needsReview === true,
                  reviewReasons: result.reviewReasons ?? result.tags.reviewReasons ?? [],
                  reviewSeverity: result.reviewSeverity ?? result.tags.reviewSeverity,
                  analysisStatus: result.analysisStatus ?? result.tags.analysisStatus,
                }
              : it,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  status: "error",
                  previewUrl: it.previewUrl,
                  fileName: it.fileName,
                  id: it.id,
                  error: mapErrorCode(msg, t),
                }
              : it,
          ),
        );
      }
    },
    [t],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;

      const seeds: Stage[] = files.map((file) => ({
        status: "queued" as const,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        id: String(++nextId),
      }));

      setItems((prev) => [...seeds, ...prev]);

      // Concurrency defaults to 1 because Gemini's free tier is 5 requests/min.
      // Set VITE_IMPORT_CONCURRENCY higher after enabling paid Gemini billing.
      const queue = [...seeds];
      const fileById = new Map(files.map((file, idx) => [seeds[idx].id, file]));

      const worker = async (): Promise<void> => {
        while (queue.length) {
          const next = queue.shift();
          if (!next) return;
          const file = fileById.get(next.id);
          if (file) await processFile(file, next.id);
        }
      };

      void Promise.all(Array.from({ length: IMPORT_CONCURRENCY }, () => worker()));
    },
    [processFile],
  );

  const inFlight = items.filter(
    (i) => i.status === "queued" || i.status === "uploading" || i.status === "analyzing",
  ).length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const steps = [
    { title: t("import.step1Title"), copy: t("import.step1Desc") },
    { title: t("import.step2Title"), copy: t("import.step2Desc") },
    { title: t("import.step3Title"), copy: t("import.step3Desc") },
  ];

  return (
    <div className="page-shell-tight space-y-8">
      <DropZone onFiles={handleFiles} disabled={false} />

      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <span className="page-kicker">
              <Layers size={14} />
              {t("import.kicker")}
            </span>
            <div className="space-y-4">
              <h1 className="page-title">
                {t("import.heading").split("\n").map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </h1>
              <p className="page-copy">{t("import.description")}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {steps.map((step, index) => (
              <div
                key={index}
                className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4"
              >
                <p className="section-subtitle">
                  {t("import.step")} {index + 1}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-subtitle">{t("import.reviewDesk")}</p>
              <h2 className="section-title mt-2">{t("import.directSaveHeading")}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {t("import.directSaveDesc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {inFlight > 0 && (
                <span className="status-chip bg-[rgba(201,165,90,0.12)] text-[var(--accent)]">
                  <LoaderCircle size={12} className="animate-spin" />
                  {inFlight} {t("import.inProgress")}
                </span>
              )}
              {doneCount > 0 && (
                <span className="status-chip bg-[rgba(111,212,171,0.12)] text-[var(--success)]">
                  <BadgeCheck size={12} />
                  {doneCount} {t("import.savedInline")}
                </span>
              )}
              {errorCount > 0 && (
                <span className="status-chip bg-[rgba(239,138,128,0.12)] text-[var(--danger)]">
                  <AlertTriangle size={12} />
                  {errorCount} {t("import.issue")}
                </span>
              )}
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={[
                  "luxe-card flex items-center gap-3 p-3",
                  item.status === "error" ? "border-[rgba(239,138,128,0.24)]" : "",
                  item.status === "done" && item.needsReview ? "border-amber-300/45" : "",
                  item.status === "done" && !item.needsReview ? "border-[rgba(111,212,171,0.22)]" : "",
                ].join(" ")}
              >
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {item.fileName}
                  </p>
                  {item.status === "queued" && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {t("tagEditor.pending")}
                    </p>
                  )}
                  {item.status === "uploading" && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--accent)]">
                      <LoaderCircle size={11} className="animate-spin" />
                      {t("import.processing")}
                    </p>
                  )}
                  {item.status === "analyzing" && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--accent)]">
                      <Sparkles size={11} />
                      {t("import.dropzone.kicker")}…
                    </p>
                  )}
                  {item.status === "done" && (
                    <>
                      <p
                        className={`mt-1 flex items-center gap-1.5 text-xs ${
                          item.needsReview ? "text-amber-300" : "text-[var(--success)]"
                        }`}
                      >
                        {item.needsReview ? <AlertTriangle size={11} /> : <BadgeCheck size={11} />}
                        {item.analysisStatus === "failed"
                          ? "Не вдалось розпізнати"
                          : item.needsReview
                            ? t("tagEditor.needsReview")
                            : t("import.savedInline")}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {t(`categories.${item.category}`)} · {item.colorPrimary}
                      </p>
                      {item.needsReview && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-muted)]">
                          {item.analysisStatus === "failed"
                            ? "Відкрийте редактор речі й заповніть поля вручну."
                            : t("tagEditor.lowConfidenceHint")}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/wardrobe?item=${encodeURIComponent(item.itemId)}`)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline"
                      >
                        {t("import.editInWardrobe")}
                        <ArrowRight size={11} />
                      </button>
                    </>
                  )}
                  {item.status === "error" && (
                    <>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--danger)]">
                        <AlertTriangle size={11} />
                        {item.error}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="mt-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        {t("common.close")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {doneCount > 0 && (
            <button
              type="button"
              onClick={() => navigate("/wardrobe")}
              className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm"
            >
              {t("import.openWardrobe")}
              <ArrowRight size={15} />
            </button>
          )}
        </section>
      )}
    </div>
  );
}
