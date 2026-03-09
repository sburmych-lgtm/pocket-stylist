import { useCallback, useState } from "react";
import { Layers, ArrowRight, LoaderCircle, BadgeCheck, AlertTriangle } from "lucide-react";
import { DropZone } from "../components/import/DropZone";
import { TagEditor } from "../components/import/TagEditor";
import { analyzeImage, saveItems } from "../services/api";
import { compressImageToBase64 } from "../utils/imageCompress";
import { useI18n } from "../i18n";
import type { ImportItem, WardrobeItemTag } from "../types/wardrobe";

let nextId = 0;

export function ImportPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ text: string; isError: boolean } | null>(null);

  const processFile = useCallback(async (file: File, id: string) => {
    try {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "uploading" as const } : item)),
      );
      // Compress image client-side to avoid 413 errors
      const base64 = await compressImageToBase64(file);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "analyzing" as const } : item)),
      );
      const result = await analyzeImage(base64, "image/jpeg", file.name);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "done" as const,
                tags: result.tags,
                imageUrl: result.imageUrl,
                thumbnailUrl: result.thumbnailUrl,
              }
            : item,
        ),
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "error" as const, error: (err as Error).message }
            : item,
        ),
      );
    }
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      setSaveResult(null);

      const newItems: ImportItem[] = files.map((file) => ({
        id: String(++nextId),
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
        status: "pending" as const,
      }));

      setItems((prev) => [...prev, ...newItems]);

      const queue = [...newItems];
      const fileMap = new Map(files.map((file, index) => [newItems[index].id, file]));

      const processNext = async () => {
        const item = queue.shift();
        if (!item) return;
        const file = fileMap.get(item.id);
        if (file) await processFile(file, item.id);
        await processNext();
      };

      void Promise.all([processNext(), processNext(), processNext()]);
    },
    [processFile],
  );

  const handleUpdateTags = useCallback((id: string, updates: Partial<WardrobeItemTag>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.tags ? { ...item, tags: { ...item.tags, ...updates } } : item,
      ),
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const doneItems = items.filter((item) => item.status === "done");
  const pendingCount = items.filter((item) =>
    ["pending", "uploading", "analyzing"].includes(item.status),
  ).length;
  const errorCount = items.filter((item) => item.status === "error").length;

  const handleSave = async () => {
    if (!doneItems.length) return;
    setSaving(true);
    setSaveResult(null);

    try {
      const payload = doneItems.map((item) => ({
        imageUrl: item.imageUrl!,
        thumbnailUrl: item.thumbnailUrl!,
        category: item.tags!.category,
        subcategory: item.tags!.subcategory,
        colorPrimary: item.tags!.colorPrimary,
        colorHex: item.tags!.colorHex,
        pattern: item.tags!.pattern,
        fabric: item.tags!.fabric,
        formalityLevel: item.tags!.formalityLevel,
        season: item.tags!.season,
        brand: item.tags!.brand ?? undefined,
        confidence: item.tags!.confidence,
      }));

      const result = await saveItems(payload);
      setSaveResult({ text: t("import.savedCount", { count: result.saved }), isError: false });
      setItems((prev) => prev.filter((item) => item.status !== "done"));
    } catch (err) {
      setSaveResult({ text: `${t("common.error")}: ${(err as Error).message}`, isError: true });
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { title: t("import.step1Title"), copy: t("import.step1Desc") },
    { title: t("import.step2Title"), copy: t("import.step2Desc") },
    { title: t("import.step3Title"), copy: t("import.step3Desc") },
  ];

  return (
    <div className="page-shell-tight space-y-8">
      {/* Upload zone at top for better UX */}
      <DropZone onFiles={handleFiles} disabled={pendingCount > 0} />

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
              <div key={index} className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">{t("import.step")} {index + 1}</p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
            <div className="luxe-card p-6">
              <p className="section-subtitle">{t("import.batchOverview")}</p>
              <h2 className="section-title mt-2">{t("import.currentBatch")}</h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="section-subtitle">{t("import.files")}</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
                    {items.length}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[var(--accent)]">
                      <LoaderCircle size={16} className={pendingCount > 0 ? "animate-spin" : ""} />
                      <p className="section-subtitle text-[var(--accent)]">{t("import.processing")}</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{pendingCount}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[var(--success)]">
                      <BadgeCheck size={16} />
                      <p className="section-subtitle text-[var(--success)]">{t("import.ready")}</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{doneItems.length}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[var(--danger)]">
                      <AlertTriangle size={16} />
                      <p className="section-subtitle text-[var(--danger)]">{t("import.needsFix")}</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{errorCount}</p>
                  </div>
                </div>
              </div>

              <div className="editorial-divider my-5" />

              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                {t("import.lowConfidenceHint")}
              </p>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || doneItems.length === 0}
                className="primary-action mt-6 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
              >
                {saving ? t("import.saving") : t("import.saveToWardrobe")}
                <ArrowRight size={15} />
              </button>
            </div>

            {saveResult && (
              <div
                className={[
                  "luxe-card p-4 text-sm leading-6",
                  saveResult.isError
                    ? "border-[rgba(239,138,128,0.22)] text-[var(--danger)]"
                    : "border-[rgba(111,212,171,0.22)] text-[var(--success)]",
                ].join(" ")}
              >
                {saveResult.text}
              </div>
            )}
          </aside>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-subtitle">{t("import.reviewDesk")}</p>
                <h2 className="section-title mt-2">{t("import.reviewHeading")}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingCount > 0 && (
                  <span className="status-chip bg-[rgba(201,165,90,0.12)] text-[var(--accent)]">
                    <LoaderCircle size={12} className="animate-spin" />
                    {pendingCount} {t("import.inProgress")}
                  </span>
                )}
                {doneItems.length > 0 && (
                  <span className="status-chip bg-[rgba(111,212,171,0.12)] text-[var(--success)]">
                    <BadgeCheck size={12} />
                    {doneItems.length} {t("import.ready")}
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

            <div className="space-y-4">
              {items.map((item) => (
                <TagEditor
                  key={item.id}
                  item={item}
                  onUpdate={handleUpdateTags}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
