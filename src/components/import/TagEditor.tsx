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
      <span className={`text-xs font-medium ${lowConfidence ? "text-amber-400" : "text-[#f0ece4]/45"}`}>
        {label} {lowConfidence && "\u26A0"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-2 py-1.5 text-sm ${
          lowConfidence
            ? "border-amber-500/30 bg-amber-500/5 text-[#f0ece4]"
            : "border-white/[0.06] bg-white/[0.05] text-[#f0ece4]"
        }`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#1a1a2e] text-[#f0ece4]">
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
      <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-4">
        <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.03]">
          <img src={item.previewUrl} alt={item.fileName} className="h-full w-full object-cover" />
        </div>
        <div className="flex-1">
          <p className="truncate text-sm font-medium text-[#f0ece4]/80">{item.fileName}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#c9a55a]" />
            <span className="text-xs capitalize text-[#f0ece4]/45">{item.status}...</span>
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "error") {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
        <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.03]">
          <img src={item.previewUrl} alt={item.fileName} className="h-full w-full object-cover" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-400">{item.fileName}</p>
          <p className="mt-1 text-xs text-red-400/70">{item.error ?? "Analysis failed"}</p>
        </div>
        <button onClick={() => onRemove(item.id)} className="text-sm text-red-400 hover:text-red-300">
          Видалити
        </button>
      </div>
    );
  }

  const tags = item.tags!;
  const lowConf = tags.confidence < 0.7;

  return (
    <div className={`rounded-xl border p-4 ${lowConf ? "border-amber-500/30 bg-amber-500/5" : "border-white/[0.06] bg-[#1a1a2e]"}`}>
      <div className="flex gap-4">
        <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.03]">
          <img src={item.previewUrl} alt={item.fileName} className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <p className="max-w-[200px] truncate text-sm font-medium text-[#f0ece4]/80">
              {item.fileName}
            </p>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                tags.confidence >= 0.8
                  ? "bg-emerald-500/10 text-emerald-400"
                  : tags.confidence >= 0.5
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
              }`}>
                {Math.round(tags.confidence * 100)}%
              </span>
              <button onClick={() => onRemove(item.id)}
                className="text-[#f0ece4]/25 transition-colors hover:text-red-400" title="Remove">
                &times;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SelectField label="Категорія" value={tags.category} options={CATEGORIES}
              onChange={(v) => onUpdate(item.id, { category: v })} lowConfidence={lowConf} />
            <SelectField label="Колір" value={tags.colorPrimary} options={COLORS}
              onChange={(v) => onUpdate(item.id, { colorPrimary: v })} lowConfidence={lowConf} />
            <SelectField label="Візерунок" value={tags.pattern} options={PATTERNS}
              onChange={(v) => onUpdate(item.id, { pattern: v })} lowConfidence={lowConf} />
            <SelectField label="Сезон" value={tags.season} options={SEASONS}
              onChange={(v) => onUpdate(item.id, { season: v })} lowConfidence={lowConf} />
          </div>

          <div className="flex items-center gap-3 text-xs text-[#f0ece4]/35">
            {tags.subcategory && <span className="rounded bg-white/[0.06] px-2 py-0.5">{tags.subcategory}</span>}
            {tags.fabric && <span className="rounded bg-white/[0.06] px-2 py-0.5">{tags.fabric}</span>}
            {tags.brand && <span className="rounded bg-white/[0.06] px-2 py-0.5">{tags.brand}</span>}
            <span className="rounded bg-white/[0.06] px-2 py-0.5">
              Формальність: {tags.formalityLevel}/5
            </span>
            {tags.colorHex && (
              <span className="inline-block h-4 w-4 rounded-full border border-white/10"
                style={{ backgroundColor: tags.colorHex }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
