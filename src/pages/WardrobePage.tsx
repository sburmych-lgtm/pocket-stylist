import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { wardrobeApi, type WardrobeItem } from "../services/api";
import { useI18n } from "../i18n";
import { enumLabel } from "../i18n/enumLabel";
import { WARDROBE_CATEGORIES, normalizeCategory } from "../shared/wardrobe-categories";
import { WARDROBE_SEASONS, type WardrobeSeason } from "../shared/wardrobe-seasons";
import { CatalogImage } from "../components/common/CatalogImage";

const CATEGORY_ICONS: Record<string, string> = {
  all: "👗",
  tops: "👕",
  bottoms: "👖",
  jeans: "👖",
  pants: "👖",
  skirts: "▱",
  dresses: "👗",
  outerwear: "🧥",
  footwear: "👟",
  swimwear: "▱",
  pajamas: "🌙",
  underwear: "▱",
  accessories: "👜",
  sportswear: "🏃",
  suits: "🤵",
};

const CATEGORY_KEYS = ["all", ...WARDROBE_CATEGORIES] as const;

const COLOR_OPTIONS = [
  "unknown",
  "black",
  "white",
  "off-white",
  "cream",
  "grey",
  "charcoal",
  "navy",
  "blue",
  "light-blue",
  "denim-blue",
  "beige",
  "camel",
  "taupe",
  "coffee",
  "mocha",
  "stone",
  "khaki",
  "olive",
  "brown",
  "tan",
  "red",
  "burgundy",
  "pink",
  "green",
  "yellow",
  "orange",
  "purple",
  "lavender",
  "gold",
  "silver",
  "multicolor",
];

const PATTERN_OPTIONS = [
  "unknown",
  "solid",
  "striped",
  "plaid",
  "checkered",
  "houndstooth",
  "floral",
  "polka-dot",
  "geometric",
  "animal-print",
  "abstract",
  "paisley",
  "camouflage",
  "graphic",
];

const FABRIC_OPTIONS = [
  "unknown",
  "cotton",
  "polyester",
  "silk",
  "wool",
  "denim",
  "leather",
  "linen",
  "cashmere",
  "nylon",
  "fleece",
  "velvet",
  "suede",
  "knit",
  "chiffon",
  "viscose",
  "rayon",
  "spandex",
  "elastane",
  "acrylic",
  "polyamide",
];

const SEASON_OPTIONS = WARDROBE_SEASONS;

type WardrobeDraft = {
  category: string;
  subcategory: string;
  colorPrimary: string;
  colorHex: string;
  pattern: string;
  fabric: string;
  formalityLevel: number;
  season: WardrobeSeason;
  brand: string;
  sharedWithFamily: boolean;
};

function draftFromItem(item: WardrobeItem): WardrobeDraft {
  return {
    category: item.category,
    subcategory: item.subcategory ?? "",
    colorPrimary: item.colorPrimary || "unknown",
    colorHex: item.colorHex ?? "#808080",
    pattern: item.pattern || "unknown",
    fabric: item.fabric ?? "unknown",
    formalityLevel: item.formalityLevel || 3,
    season: (item.season as WardrobeDraft["season"]) || "all",
    brand: item.brand ?? "",
    sharedWithFamily: item.sharedWithFamily === true,
  };
}

function statusLabel(item: WardrobeItem): { tone: "ok" | "suggestion" | "critical"; label: string } {
  if (item.analysisStatus === "failed" || item.reviewSeverity === "critical") {
    return { tone: "critical", label: "Не розпізнано" };
  }
  if (item.needsReview) {
    return { tone: "suggestion", label: "Уточнити" };
  }
  return { tone: "ok", label: "OK" };
}

function inputClass() {
  return "w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]/45 focus:ring-2 focus:ring-[var(--accent)]/15";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ItemCard({ item, onOpen }: { item: WardrobeItem; onOpen: (item: WardrobeItem) => void }) {
  const { t } = useI18n();
  const status = statusLabel(item);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={[
        "group relative overflow-hidden rounded-2xl border bg-[#1a1a2e] text-left shadow-lg shadow-black/20 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40",
        status.tone !== "ok"
          ? "border-amber-300/55 shadow-amber-950/20 hover:border-amber-300/75"
          : "border-white/[0.06] hover:border-white/[0.12]",
      ].join(" ")}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/[0.03]">
        <CatalogImage
          imageUrl={item.imageUrl}
          fallbackUrl={item.thumbnailUrl ?? item.imageUrl}
          alt={item.category}
          className="h-full w-full bg-[#f7f2e8] object-contain p-2 transition-transform duration-300 group-hover:scale-105"
        />
        {status.tone !== "ok" && (
          <div
            className={[
              "absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-lg backdrop-blur-md",
              status.tone === "critical"
                ? "border-red-300/45 bg-red-500/90 text-white"
                : "border-amber-300/45 bg-amber-400/90 text-[#1b1304]",
            ].join(" ")}
          >
            <AlertTriangle size={12} />
            <span className="truncate">{status.label}</span>
          </div>
        )}
        {item.sharedWithFamily && (
          <div className="absolute right-2 top-2 rounded-full border border-emerald-300/35 bg-emerald-500/85 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
            Family
          </div>
        )}
      </div>

      <div className="p-2">
        <div className="flex items-center gap-1.5">
          {item.colorHex && (
            <span
              className="inline-block h-3 w-3 rounded-full border border-white/10"
              style={{ backgroundColor: item.colorHex }}
            />
          )}
          <span className="truncate text-xs font-medium text-[#f0ece4]/85">
            {item.subcategory ?? t(`categories.${item.category}`)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#f0ece4]/35">
          <span>{enumLabel(t, "colors", item.colorPrimary)}</span>
          <span>·</span>
          <span>{enumLabel(t, "patterns", item.pattern)}</span>
          {item.brand && (
            <>
              <span>·</span>
              <span>{item.brand}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function WardrobeItemEditor({
  item,
  onClose,
  onSave,
  onDelete,
  onReanalyze,
}: {
  item: WardrobeItem;
  onClose: () => void;
  onSave: (itemId: string, draft: WardrobeDraft) => Promise<void>;
  onDelete: (itemId: string) => Promise<void> | void;
  onReanalyze: (itemId: string) => Promise<WardrobeItem>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => draftFromItem(item));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = statusLabel(item);

  useEffect(() => setDraft(draftFromItem(item)), [item]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving && !deleting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting, onClose, saving]);

  const updateDraft = <K extends keyof WardrobeDraft>(key: K, value: WardrobeDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(item.id, draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(item.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      const fresh = await onReanalyze(item.id);
      setDraft(draftFromItem(fresh));
    } catch (error) {
      setReanalyzeError(
        error instanceof Error && error.message.includes("demo")
          ? t("wardrobe.reanalyzeDemo")
          : t("wardrobe.reanalyzeFailed"),
      );
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] bg-[#070811]/96 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[#070811]/92 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">Гардероб</p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Редагування речі</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--text-primary)] disabled:opacity-50"
            aria-label="Закрити"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 pb-28">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.03]">
                <CatalogImage
                  imageUrl={item.imageUrl}
                  fallbackUrl={item.imageUrl}
                  alt={item.subcategory ?? item.category}
                  className="max-h-[70vh] w-full bg-[#f7f2e8] object-contain p-3"
                />
              </div>
              {status.tone !== "ok" && (
                <div
                  className={[
                    "rounded-3xl border p-4 text-sm leading-6",
                    status.tone === "critical"
                      ? "border-red-300/25 bg-red-500/10 text-red-100"
                      : "border-amber-300/25 bg-amber-300/10 text-amber-100",
                  ].join(" ")}
                >
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <AlertTriangle size={16} />
                    {status.label}
                  </div>
                  <p className="text-xs opacity-85">
                    {item.analysisStatus === "failed"
                      ? "AI не зміг надійно розпізнати фото. Дані не вигадані — перевірте поля нижче й збережіть."
                      : "AI позначив частину атрибутів як сумнівні. Якщо все правильно — просто натисніть “Зберегти”."}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleReanalyze}
                disabled={reanalyzing || saving || deleting}
                className="flex w-full items-center justify-center gap-2 rounded-3xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-50"
              >
                <Sparkles size={16} className={reanalyzing ? "animate-pulse" : ""} />
                {reanalyzing ? t("wardrobe.reanalyzing") : t("wardrobe.reanalyze")}
              </button>
              {reanalyzeError && <p className="text-xs text-red-300">{reanalyzeError}</p>}
            </div>

            <div className="space-y-4 rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-4">
              <Field label="Назва / тип речі">
                <input
                  value={draft.subcategory}
                  onChange={(event) => updateDraft("subcategory", event.target.value)}
                  className={inputClass()}
                  placeholder="Напр. блейзер, сорочка, чінос"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("wardrobe.category")}>
                  <select
                    value={draft.category}
                    onChange={(event) => updateDraft("category", event.target.value)}
                    className={inputClass()}
                  >
                    {WARDROBE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#11131f]">
                        {t(`categories.${cat}`)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("wardrobe.color")}>
                  <select
                    value={draft.colorPrimary}
                    onChange={(event) => updateDraft("colorPrimary", event.target.value)}
                    className={inputClass()}
                  >
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color} className="bg-[#11131f]">
                        {enumLabel(t, "colors", color)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                <Field label="Колір у фото">
                  <input
                    type="color"
                    value={draft.colorHex}
                    onChange={(event) => updateDraft("colorHex", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.05] p-1"
                  />
                </Field>

                <Field label={t("wardrobe.pattern")}>
                  <select
                    value={draft.pattern}
                    onChange={(event) => updateDraft("pattern", event.target.value)}
                    className={inputClass()}
                  >
                    {PATTERN_OPTIONS.map((pattern) => (
                      <option key={pattern} value={pattern} className="bg-[#11131f]">
                        {enumLabel(t, "patterns", pattern)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("wardrobe.fabric")}>
                  <select
                    value={draft.fabric}
                    onChange={(event) => updateDraft("fabric", event.target.value)}
                    className={inputClass()}
                  >
                    {FABRIC_OPTIONS.map((fabric) => (
                      <option key={fabric} value={fabric} className="bg-[#11131f]">
                        {enumLabel(t, "fabrics", fabric)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("wardrobe.season")}>
                  <select
                    value={draft.season}
                    onChange={(event) => updateDraft("season", event.target.value as WardrobeDraft["season"])}
                    className={inputClass()}
                  >
                    {SEASON_OPTIONS.map((season) => (
                      <option key={season} value={season} className="bg-[#11131f]">
                        {t(`seasons.${season}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={t("wardrobe.formality")}>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      type="button"
                      key={level}
                      onClick={() => updateDraft("formalityLevel", level)}
                      className={`h-11 flex-1 rounded-2xl border text-sm font-semibold transition ${
                        draft.formalityLevel >= level
                          ? "border-[var(--accent)]/45 bg-[var(--accent)] text-[#090b12]"
                          : "border-white/[0.08] bg-white/[0.04] text-[var(--text-secondary)]"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Бренд">
                <input
                  value={draft.brand}
                  onChange={(event) => updateDraft("brand", event.target.value)}
                  className={inputClass()}
                  placeholder="Якщо видно або хочете вказати вручну"
                />
              </Field>

              <label className="flex items-start gap-3 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
                <input
                  type="checkbox"
                  checked={draft.sharedWithFamily}
                  onChange={(event) => updateDraft("sharedWithFamily", event.target.checked)}
                  className="mt-1 h-5 w-5 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">
                    Поділитися з родиною
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                    Якщо увімкнено, ця річ може потрапляти в сімейні підбори образів.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.08] bg-[#070811]/95 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl gap-2">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting || saving}
                  className="ghost-action flex-1 rounded-full px-4 py-3 text-xs font-semibold disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="flex-1 rounded-full bg-[var(--danger)] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {deleting ? t("import.saving") : "Так, видалити"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || deleting}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-200 disabled:opacity-50"
                  aria-label={t("wardrobe.delete")}
                >
                  <Trash2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving || deleting}
                  className="ghost-action flex-1 rounded-full px-4 py-3 text-xs font-semibold disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || deleting}
                  className="gold-btn flex-[1.4] px-4 py-3 text-xs disabled:opacity-50"
                >
                  {saving ? t("import.saving") : t("common.save")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyWardrobe() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[var(--accent)]/20 p-12 text-center">
      <div className="text-5xl">👗</div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
        {t("wardrobe.emptyTitle")}
      </h3>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">
        {t("wardrobe.emptyDesc")}
      </p>
      <button
        type="button"
        onClick={() => navigate("/import")}
        className="gold-btn px-6 py-2.5 text-sm"
      >
        {t("wardrobe.uploadClothing")}
      </button>
    </div>
  );
}

export function WardrobePage() {
  const { t } = useI18n();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadItems = useCallback(async () => {
    try {
      const data = await wardrobeApi.getAll();
      setItems(data.map((it) => ({ ...it, category: normalizeCategory(it.category) })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    const itemId = searchParams.get("item");
    if (itemId) setSelectedItemId(itemId);
  }, [searchParams]);

  const closeEditor = useCallback(() => {
    setSelectedItemId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("item");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openEditor = useCallback(
    (item: WardrobeItem) => {
      setSelectedItemId(item.id);
      const next = new URLSearchParams(searchParams);
      next.set("item", item.id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleDelete = useCallback(
    async (itemId: string) => {
      try {
        await wardrobeApi.deleteItem(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("common.error"));
        throw e;
      }
    },
    [t],
  );

  const handleSave = useCallback(
    async (itemId: string, draft: WardrobeDraft) => {
      const previous = items;
      const optimisticPatch = {
        category: normalizeCategory(draft.category),
        subcategory: draft.subcategory.trim() || null,
        colorPrimary: draft.colorPrimary,
        colorHex: draft.colorHex || null,
        pattern: draft.pattern,
        fabric: draft.fabric.trim() || null,
        formalityLevel: draft.formalityLevel,
        season: draft.season,
        brand: draft.brand.trim() || null,
        sharedWithFamily: draft.sharedWithFamily,
        needsReview: false,
        reviewReasons: [],
        reviewSeverity: "ok" as const,
        analysisStatus: "ok" as const,
        analysisReliable: true,
      };

      setItems((current) =>
        current.map((item) =>
          item.id === itemId ? { ...item, ...optimisticPatch } : item,
        ),
      );

      try {
        const { item } = await wardrobeApi.updateItem(itemId, {
          category: optimisticPatch.category,
          subcategory: optimisticPatch.subcategory,
          colorPrimary: optimisticPatch.colorPrimary,
          colorHex: optimisticPatch.colorHex,
          pattern: optimisticPatch.pattern,
          fabric: optimisticPatch.fabric,
          formalityLevel: optimisticPatch.formalityLevel,
          season: optimisticPatch.season,
          brand: optimisticPatch.brand,
          sharedWithFamily: optimisticPatch.sharedWithFamily,
        });
        setItems((current) =>
          current.map((existing) =>
            existing.id === itemId ? { ...item, category: normalizeCategory(item.category) } : existing,
          ),
        );
      } catch (e) {
        setItems(previous);
        setError(e instanceof Error ? e.message : t("common.error"));
        throw e;
      }
    },
    [items, t],
  );

  const handleReanalyze = useCallback(
    async (itemId: string): Promise<WardrobeItem> => {
      const { item } = await wardrobeApi.reanalyze(itemId);
      const fresh = { ...item, category: normalizeCategory(item.category) };
      setItems((current) =>
        current.map((existing) => (existing.id === itemId ? fresh : existing)),
      );
      return fresh;
    },
    [],
  );

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (activeCategory !== "all" && item.category !== activeCategory) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            item.category.toLowerCase().includes(q) ||
            (item.subcategory?.toLowerCase().includes(q) ?? false) ||
            item.colorPrimary.toLowerCase().includes(q) ||
            (item.brand?.toLowerCase().includes(q) ?? false) ||
            (item.fabric?.toLowerCase().includes(q) ?? false)
          );
        }
        return true;
      }),
    [activeCategory, items, searchQuery],
  );

  const categoryCounts = useMemo(
    () =>
      items.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {}),
    [items],
  );

  const selectedItem = selectedItemId
    ? items.find((item) => item.id === selectedItemId) ?? null
    : null;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="skeleton mb-2 h-8 w-48" />
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="skeleton h-10 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-[var(--accent)]">
            {t("wardrobe.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {items.length} {t("common.items")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/import")}
          className="gold-btn flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus size={16} />
          {t("wardrobe.addClothing")}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyWardrobe />
      ) : (
        <>
          <div className="mb-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("wardrobe.searchPlaceholder")}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20"
              />
            </div>
          </div>

          <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORY_KEYS.map((key) => {
              const count = key === "all" ? items.length : (categoryCounts[key] ?? 0);
              if (key !== "all" && count === 0) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-300 ${
                    activeCategory === key
                      ? "bg-[var(--accent)] text-[#0a0c12]"
                      : "bg-white/[0.05] text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{CATEGORY_ICONS[key]}</span>
                  <span>{t(`categories.${key}`)}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      activeCategory === key
                        ? "bg-[#0a0c12]/20 text-[#0a0c12]"
                        : "bg-white/[0.06] text-[var(--text-muted)]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.06] p-8 text-center">
              <p className="text-[var(--text-muted)]">
                {searchQuery ? t("wardrobe.notFound") : t("wardrobe.emptyCategory")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((item) => (
                <ItemCard key={item.id} item={item} onOpen={openEditor} />
              ))}
            </div>
          )}
        </>
      )}

      {selectedItem && (
        <WardrobeItemEditor
          item={selectedItem}
          onClose={closeEditor}
          onSave={handleSave}
          onDelete={handleDelete}
          onReanalyze={handleReanalyze}
        />
      )}
    </div>
  );
}
