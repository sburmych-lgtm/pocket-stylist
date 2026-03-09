import { useCallback, useState } from "react";
import { Layers, ArrowRight, LoaderCircle, BadgeCheck, AlertTriangle } from "lucide-react";
import { DropZone } from "../components/import/DropZone";
import { TagEditor } from "../components/import/TagEditor";
import { analyzeImage, saveItems } from "../services/api";
import type { ImportItem, WardrobeItemTag } from "../types/wardrobe";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let nextId = 0;

export function ImportPage() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  const processFile = useCallback(async (file: File, id: string) => {
    try {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "uploading" as const } : item)),
      );
      const base64 = await fileToBase64(file);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "analyzing" as const } : item)),
      );
      const result = await analyzeImage(base64, file.type, file.name);
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
        if (!item) {
          return;
        }

        const file = fileMap.get(item.id);
        if (file) {
          await processFile(file, item.id);
        }
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
    if (!doneItems.length) {
      return;
    }

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
      setSaveResult(`Збережено ${result.saved} речей у гардероб!`);
      setItems((prev) => prev.filter((item) => item.status !== "done"));
    } catch (err) {
      setSaveResult(`Помилка: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell-tight space-y-8">
      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <span className="page-kicker">
              <Layers size={14} />
              Import Pipeline
            </span>
            <div className="space-y-4">
              <h1 className="page-title">
                Створіть свій
                <br />
                luxury wardrobe index.
              </h1>
              <p className="page-copy">
                Ми перетворюємо сирі фото речей на чисті fashion cards: категорія, колір,
                сезон, тканина й готовність до AI-рекомендацій.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                title: "Upload",
                copy: "Додавайте flat lays, селфі або окремі предмети одягу.",
              },
              {
                title: "Refine",
                copy: "Перевірте сумнівні AI-поля перед фінальним збереженням.",
              },
              {
                title: "Save",
                copy: "Готові картки миттєво підуть у ваш digital wardrobe.",
              },
            ].map((step, index) => (
              <div key={step.title} className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">Step {index + 1}</p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DropZone onFiles={handleFiles} disabled={pendingCount > 0} />

      {items.length > 0 && (
        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
            <div className="luxe-card p-6">
              <p className="section-subtitle">Batch Overview</p>
              <h2 className="section-title mt-2">Поточна fashion-партія</h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="section-subtitle">Files</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
                    {items.length}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[var(--accent)]">
                      <LoaderCircle size={16} className={pendingCount > 0 ? "animate-spin" : ""} />
                      <p className="section-subtitle text-[var(--accent)]">Processing</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{pendingCount}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[var(--success)]">
                      <BadgeCheck size={16} />
                      <p className="section-subtitle text-[var(--success)]">Ready</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{doneItems.length}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[var(--danger)]">
                      <AlertTriangle size={16} />
                      <p className="section-subtitle text-[var(--danger)]">Needs Fix</p>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{errorCount}</p>
                  </div>
                </div>
              </div>

              <div className="editorial-divider my-5" />

              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Рекомендуємо підтвердити low-confidence items перед збереженням, щоб
                система краще працювала зі стилізацією та аналітикою.
              </p>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || doneItems.length === 0}
                className="primary-action mt-6 inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
              >
                {saving ? "Зберігаю..." : "Зберегти в гардероб"}
                <ArrowRight size={15} />
              </button>
            </div>

            {saveResult && (
              <div
                className={[
                  "luxe-card p-4 text-sm leading-6",
                  saveResult.startsWith("Помилка")
                    ? "border-[rgba(239,138,128,0.22)] text-[var(--danger)]"
                    : "border-[rgba(111,212,171,0.22)] text-[var(--success)]",
                ].join(" ")}
              >
                {saveResult}
              </div>
            )}
          </aside>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-subtitle">Review Desk</p>
                <h2 className="section-title mt-2">Перевірка та фіксація metadata</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingCount > 0 && (
                  <span className="status-chip bg-[rgba(214,177,111,0.12)] text-[var(--accent)]">
                    <LoaderCircle size={12} className="animate-spin" />
                    {pendingCount} у роботі
                  </span>
                )}
                {doneItems.length > 0 && (
                  <span className="status-chip bg-[rgba(111,212,171,0.12)] text-[var(--success)]">
                    <BadgeCheck size={12} />
                    {doneItems.length} ready
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="status-chip bg-[rgba(239,138,128,0.12)] text-[var(--danger)]">
                    <AlertTriangle size={12} />
                    {errorCount} issue
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
