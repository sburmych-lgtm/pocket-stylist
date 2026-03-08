import type { ImportItem, WardrobeItemTag } from "../../types/wardrobe";

const CATEGORIES = [
  "tops", "bottoms", "dresses", "outerwear", "shoes",
  "accessories", "activewear", "swimwear", "sleepwear", "suits",
];

const COLORS = [
  "black", "white", "grey", "navy", "blue", "light-blue", "red", "burgundy",
  "pink", "green", "olive", "beige", "brown", "tan", "cream", "yellow",
  "orange", "purple", "lavender", "gold", "silver", "multicolor",
];

const PATTERNS = [
  "solid", "striped", "plaid", "floral", "polka-dot", "geometric",
  "animal-print", "abstract", "paisley", "camouflage", "graphic",
];

const SEASONS = ["spring", "summer", "fall", "winter", "all"];

interface TagEditorProps {
  item: ImportItem;
  onUpdate: (id: string, tags: Partial<WardrobeItemTag>) => void;
  onRemove: (id: string) => void;
}

function SelectField({
  label,
  value,
  options,
  onChange,
  lowConfidence,
}: {
  label: string;
  value: string;
  options: readonly string[] | string[];
  onChange: (v: string) => void;
  lowConfidence?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-xs font-medium ${lowConfidence ? "text-amber-600" : "text-neutral-500"}`}>
        {label} {lowConfidence && "\u26A0"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-2 py-1.5 text-sm ${
          lowConfidence ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"
        }`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TagEditor({ item, onUpdate, onRemove }: TagEditorProps) {
  if (item.status === "pending" || item.status === "uploading" || item.status === "analyzing") {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
          <img
            src={item.previewUrl}
            alt={item.fileName}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-700 truncate">{item.fileName}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
            <span className="text-xs text-neutral-500 capitalize">{item.status}...</span>
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "error") {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
          <img
            src={item.previewUrl}
            alt={item.fileName}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700">{item.fileName}</p>
          <p className="mt-1 text-xs text-red-600">{item.error ?? "Analysis failed"}</p>
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
    );
  }

  const tags = item.tags!;
  const lowConf = tags.confidence < 0.7;

  return (
    <div className={`rounded-xl border p-4 ${lowConf ? "border-amber-300 bg-amber-50/30" : "border-neutral-200 bg-white"}`}>
      <div className="flex gap-4">
        <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
          <img
            src={item.previewUrl}
            alt={item.fileName}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700 truncate max-w-[200px]">
              {item.fileName}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  tags.confidence >= 0.8
                    ? "bg-green-100 text-green-700"
                    : tags.confidence >= 0.5
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {Math.round(tags.confidence * 100)}%
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="text-neutral-400 hover:text-red-500 transition-colors"
                title="Remove"
              >
                &times;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SelectField
              label="Category"
              value={tags.category}
              options={CATEGORIES}
              onChange={(v) => onUpdate(item.id, { category: v })}
              lowConfidence={lowConf}
            />
            <SelectField
              label="Color"
              value={tags.colorPrimary}
              options={COLORS}
              onChange={(v) => onUpdate(item.id, { colorPrimary: v })}
              lowConfidence={lowConf}
            />
            <SelectField
              label="Pattern"
              value={tags.pattern}
              options={PATTERNS}
              onChange={(v) => onUpdate(item.id, { pattern: v })}
              lowConfidence={lowConf}
            />
            <SelectField
              label="Season"
              value={tags.season}
              options={SEASONS}
              onChange={(v) => onUpdate(item.id, { season: v })}
              lowConfidence={lowConf}
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-neutral-500">
            {tags.subcategory && <span className="rounded bg-neutral-100 px-2 py-0.5">{tags.subcategory}</span>}
            {tags.fabric && <span className="rounded bg-neutral-100 px-2 py-0.5">{tags.fabric}</span>}
            {tags.brand && <span className="rounded bg-neutral-100 px-2 py-0.5">{tags.brand}</span>}
            <span className="rounded bg-neutral-100 px-2 py-0.5">
              Formality: {tags.formalityLevel}/5
            </span>
            {tags.colorHex && (
              <span
                className="inline-block h-4 w-4 rounded-full border border-neutral-300"
                style={{ backgroundColor: tags.colorHex }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
