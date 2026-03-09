import { AlertTriangle, BadgeCheck, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import type { ImportItem, WardrobeItemTag } from "../../types/wardrobe";

const CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "activewear",
  "swimwear",
  "sleepwear",
  "suits",
];

const COLORS = [
  "black",
  "white",
  "grey",
  "navy",
  "blue",
  "light-blue",
  "red",
  "burgundy",
  "pink",
  "green",
  "olive",
  "beige",
  "brown",
  "tan",
  "cream",
  "yellow",
  "orange",
  "purple",
  "lavender",
  "gold",
  "silver",
  "multicolor",
];

const PATTERNS = [
  "solid",
  "striped",
  "plaid",
  "floral",
  "polka-dot",
  "geometric",
  "animal-print",
  "abstract",
  "paisley",
  "camouflage",
  "graphic",
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
    <label className="flex flex-col gap-2">
      <span
        className={[
          "text-[0.68rem] font-bold uppercase tracking-[0.18em]",
          lowConfidence ? "text-[var(--warning)]" : "text-[var(--text-muted)]",
        ].join(" ")}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "input-surface px-3 py-3 text-sm",
          lowConfidence ? "border-[rgba(241,195,121,0.3)] bg-[rgba(241,195,121,0.06)]" : "",
        ].join(" ")}
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-[var(--bg-surface-strong)] text-[var(--text-primary)]">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TagEditor({ item, onUpdate, onRemove }: TagEditorProps) {
  if (item.status === "pending" || item.status === "uploading" || item.status === "analyzing") {
    return (
      <article className="luxe-card flex items-center gap-4 p-5">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-[1.2rem] bg-white/[0.04]">
          <img src={item.previewUrl} alt={item.fileName} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="truncate text-lg font-semibold text-[var(--text-primary)]">{item.fileName}</p>
          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <LoaderCircle className="animate-spin text-[var(--accent)]" size={18} />
            <span className="capitalize">
              {item.status === "pending" ? "Готуємо файл..." : `${item.status}...`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]" />
          </div>
        </div>
      </article>
    );
  }

  if (item.status === "error") {
    return (
      <article className="luxe-card border-[rgba(239,138,128,0.24)] p-5">
        <div className="flex items-center gap-4">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-[1.2rem] bg-white/[0.04]">
            <img src={item.previewUrl} alt={item.fileName} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 text-[var(--danger)]">
              <AlertTriangle size={18} />
              <p className="truncate text-lg font-semibold">{item.fileName}</p>
            </div>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              {item.error ?? "Analysis failed"}
            </p>
          </div>
          <button type="button" onClick={() => onRemove(item.id)} className="icon-action h-11 w-11">
            <Trash2 size={16} />
          </button>
        </div>
      </article>
    );
  }

  const tags = item.tags!;
  const lowConfidence = tags.confidence < 0.7;

  return (
    <article
      className={[
        "luxe-card p-5 sm:p-6",
        lowConfidence ? "border-[rgba(241,195,121,0.26)]" : "",
      ].join(" ")}
    >
      <div className="grid gap-6 xl:grid-cols-[16rem_1fr]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[1.6rem] border border-white/8 bg-white/[0.03]">
            <img src={item.previewUrl} alt={item.fileName} className="aspect-[4/5] w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-10">
              <p className="truncate text-base font-semibold text-white">{item.fileName}</p>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <p className="section-subtitle">AI Confidence</p>
              <div
                className={[
                  "status-chip",
                  tags.confidence >= 0.8
                    ? "bg-[rgba(111,212,171,0.12)] text-[var(--success)]"
                    : tags.confidence >= 0.5
                      ? "bg-[rgba(241,195,121,0.12)] text-[var(--warning)]"
                      : "bg-[rgba(239,138,128,0.12)] text-[var(--danger)]",
                ].join(" ")}
              >
                {tags.confidence >= 0.8 ? <BadgeCheck size={13} /> : <Sparkles size={13} />}
                {Math.round(tags.confidence * 100)}%
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]"
                style={{ width: `${Math.max(tags.confidence * 100, 12)}%` }}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {lowConfidence
                ? "AI сумнівається у частині атрибутів. Перевірте поля нижче перед збереженням."
                : "Розпізнавання виглядає стабільно. Можна швидко переглянути й зберігати."}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="page-kicker">
                {lowConfidence ? <AlertTriangle size={14} /> : <BadgeCheck size={14} />}
                {lowConfidence ? "Needs Review" : "Ready To Save"}
              </span>
              <h3 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">
                Перевірте fashion metadata
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Категорія, колір і сезон безпосередньо впливають на quality ваших AI-рекомендацій.
              </p>
            </div>

            <button type="button" onClick={() => onRemove(item.id)} className="icon-action h-11 w-11">
              <Trash2 size={16} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Категорія"
              value={tags.category}
              options={CATEGORIES}
              onChange={(value) => onUpdate(item.id, { category: value })}
              lowConfidence={lowConfidence}
            />
            <SelectField
              label="Колір"
              value={tags.colorPrimary}
              options={COLORS}
              onChange={(value) => onUpdate(item.id, { colorPrimary: value })}
              lowConfidence={lowConfidence}
            />
            <SelectField
              label="Візерунок"
              value={tags.pattern}
              options={PATTERNS}
              onChange={(value) => onUpdate(item.id, { pattern: value })}
              lowConfidence={lowConfidence}
            />
            <SelectField
              label="Сезон"
              value={tags.season}
              options={SEASONS}
              onChange={(value) => onUpdate(item.id, { season: value })}
              lowConfidence={lowConfidence}
            />
          </div>

          <div className="editorial-divider" />

          <div className="flex flex-wrap gap-2">
            {tags.subcategory && (
              <span className="metric-pill">Subcategory: {tags.subcategory}</span>
            )}
            {tags.fabric && <span className="metric-pill">Fabric: {tags.fabric}</span>}
            {tags.brand && <span className="metric-pill">Brand: {tags.brand}</span>}
            <span className="metric-pill">Formality: {tags.formalityLevel}/5</span>
            {tags.colorHex && (
              <span className="metric-pill">
                Tone
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-white/10"
                  style={{ backgroundColor: tags.colorHex }}
                />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
