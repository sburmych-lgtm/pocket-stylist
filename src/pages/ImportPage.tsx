import { useCallback, useState } from "react";
import { DropZone } from "../components/import/DropZone";
import { TagEditor } from "../components/import/TagEditor";
import { analyzeImage, saveItems } from "../services/api";
import type { ImportItem, WardrobeItemTag } from "../types/wardrobe";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get raw base64
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
        prev.map((it) => (it.id === id ? { ...it, status: "uploading" as const } : it)),
      );

      const base64 = await fileToBase64(file);

      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: "analyzing" as const } : it)),
      );

      const result = await analyzeImage(base64, file.type, file.name);

      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                status: "done" as const,
                tags: result.tags,
                imageUrl: result.imageUrl,
                thumbnailUrl: result.thumbnailUrl,
              }
            : it,
        ),
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, status: "error" as const, error: (err as Error).message }
            : it,
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

      // Process in parallel with concurrency limit of 3
      const queue = [...newItems];
      const fileMap = new Map(files.map((f, i) => [newItems[i].id, f]));

      const processNext = async () => {
        const item = queue.shift();
        if (!item) return;
        const file = fileMap.get(item.id);
        if (file) await processFile(file, item.id);
        await processNext();
      };

      // Start 3 parallel workers
      void Promise.all([processNext(), processNext(), processNext()]);
    },
    [processFile],
  );

  const handleUpdateTags = useCallback(
    (id: string, updates: Partial<WardrobeItemTag>) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id && it.tags ? { ...it, tags: { ...it.tags, ...updates } } : it,
        ),
      );
    },
    [],
  );

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const doneItems = items.filter((it) => it.status === "done");
  const pendingCount = items.filter((it) =>
    ["pending", "uploading", "analyzing"].includes(it.status),
  ).length;
  const errorCount = items.filter((it) => it.status === "error").length;

  const handleSave = async () => {
    if (!doneItems.length) return;
    setSaving(true);
    setSaveResult(null);

    try {
      const payload = doneItems.map((it) => ({
        imageUrl: it.imageUrl!,
        thumbnailUrl: it.thumbnailUrl!,
        category: it.tags!.category,
        subcategory: it.tags!.subcategory,
        colorPrimary: it.tags!.colorPrimary,
        colorHex: it.tags!.colorHex,
        pattern: it.tags!.pattern,
        fabric: it.tags!.fabric,
        formalityLevel: it.tags!.formalityLevel,
        season: it.tags!.season,
        brand: it.tags!.brand ?? undefined,
        confidence: it.tags!.confidence,
      }));

      const result = await saveItems(payload);
      setSaveResult(`Saved ${result.saved} items to your wardrobe!`);
      setItems((prev) => prev.filter((it) => it.status !== "done"));
    } catch (err) {
      setSaveResult(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Import Wardrobe
        </h1>
        <p className="mt-1 text-neutral-500">
          Upload photos of your clothes — AI will automatically tag them.
        </p>
      </div>

      <DropZone onFiles={handleFiles} disabled={pendingCount > 0} />

      {items.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-neutral-700">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
              {pendingCount > 0 && (
                <span className="text-indigo-600">
                  {pendingCount} processing...
                </span>
              )}
              {doneItems.length > 0 && (
                <span className="text-green-600">
                  {doneItems.length} ready
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600">
                  {errorCount} failed
                </span>
              )}
            </div>
            {doneItems.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                  transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : `Save ${doneItems.length} to Wardrobe`}
              </button>
            )}
          </div>

          {saveResult && (
            <div
              className={`mb-4 rounded-lg p-3 text-sm ${
                saveResult.startsWith("Error")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {saveResult}
            </div>
          )}

          <div className="space-y-3">
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
      )}
    </div>
  );
}
