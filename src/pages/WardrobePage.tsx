import { useState, useEffect, useCallback } from "react";
import { wardrobeApi, type WardrobeItem } from "../services/api";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Check, X, Trash2, AlertTriangle, Users } from "lucide-react";
import { useI18n } from "../i18n";
import { WARDROBE_CATEGORIES, normalizeCategory } from "../shared/wardrobe-categories";

const CATEGORY_ICONS: Record<string, string> = {
  all: "👗",
  tops: "👕",
  bottoms: "👖",
  jeans: "👖",
  pants: "👖",
  skirts: "🩳",
  dresses: "👗",
  outerwear: "🧥",
  footwear: "👟",
  swimwear: "🩱",
  pajamas: "🛌",
  underwear: "🩲",
  accessories: "👜",
  sportswear: "🏃",
  suits: "🤵",
};

const CATEGORY_KEYS = ["all", ...WARDROBE_CATEGORIES] as const;

function ItemCard({
  item,
  onDelete,
  onCategoryChange,
  onSharingChange,
}: {
  item: WardrobeItem;
  onDelete: (id: string) => Promise<void> | void;
  onCategoryChange: (id: string, newCategory: string) => Promise<void>;
  onSharingChange: (id: string, shared: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftCategory, setDraftCategory] = useState(item.category);
  const [saving, setSaving] = useState(false);
  const needsReview = item.needsReview === true;

  // Close the confirm modal on Escape — standard modal UX.
  useEffect(() => {
    if (!deleteModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDeleteModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteModalOpen]);

  const handleDeleteConfirm = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(item.id);
      // Parent already removes the item; the card unmounts naturally.
    } finally {
      setDeleting(false);
    }
  }, [item.id, onDelete]);

  const handleSaveCategory = async () => {
    if (draftCategory === item.category) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCategoryChange(item.id, draftCategory);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-xl border bg-[#1a1a2e] shadow-lg shadow-black/20 transition-[border-color,box-shadow] duration-300 hover:shadow-xl hover:shadow-black/30",
        needsReview
          ? "border-amber-300/55 shadow-amber-950/20 hover:border-amber-300/75"
          : "border-white/[0.06] hover:border-white/[0.12]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="block aspect-[3/4] w-full overflow-hidden bg-white/[0.03]"
      >
        <img
          src={item.thumbnailUrl ?? item.imageUrl}
          alt={item.category}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void onSharingChange(item.id, !item.sharedWithFamily);
        }}
        aria-pressed={item.sharedWithFamily === true}
        aria-label={
          item.sharedWithFamily
            ? t("wardrobe.stopFamilySharing")
            : t("wardrobe.shareWithFamily")
        }
        title={
          item.sharedWithFamily
            ? t("wardrobe.stopFamilySharing")
            : t("wardrobe.shareWithFamily")
        }
        className={`absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all ${
          item.sharedWithFamily
            ? "border-emerald-300/50 bg-emerald-500/90 text-white"
            : "border-white/30 bg-black/60 text-white"
        }`}
      >
        <Users size={17} />
      </button>

      {needsReview && (
        <div
          className="absolute left-11 top-1.5 z-10 flex max-w-[calc(100%-5.8rem)] items-center gap-1 rounded-full border border-amber-300/35 bg-amber-400/90 px-2 py-1 text-[10px] font-semibold text-[#1b1304] shadow-lg"
          title={t("tagEditor.lowConfidenceHint")}
        >
          <AlertTriangle size={12} />
          <span className="truncate">{t("tagEditor.needsReview")}</span>
        </div>
      )}

      <div className="p-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
              disabled={saving}
              className="flex-1 rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-[#f0ece4] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40 disabled:opacity-50"
            >
              {WARDROBE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-[#1a1a2e]">
                  {CATEGORY_ICONS[cat] ?? "·"} {t(`categories.${cat}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveCategory}
              disabled={saving}
              aria-label={t("common.save")}
              className="rounded p-1 text-[var(--success)] hover:bg-white/10 disabled:opacity-50"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftCategory(item.category);
                setEditing(false);
              }}
              disabled={saving}
              aria-label={t("common.cancel")}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-white/10 disabled:opacity-50"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {item.colorHex && (
              <span
                className="inline-block h-3 w-3 rounded-full border border-white/10"
                style={{ backgroundColor: item.colorHex }}
              />
            )}
            <span className="truncate text-xs font-medium text-[#f0ece4]/80">
              {item.subcategory ?? t(`categories.${item.category}`)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              aria-label={t("wardrobe.editCategory")}
              className="ml-auto rounded p-1 text-[#f0ece4]/60 opacity-100 transition-all hover:bg-white/10 hover:text-[var(--accent)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <Pencil size={10} />
            </button>
          </div>
        )}
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#f0ece4]/35">
          <span>{item.colorPrimary}</span>
          <span>·</span>
          <span>{item.pattern}</span>
          {item.brand && (
            <>
              <span>·</span>
              <span>{item.brand}</span>
            </>
          )}
        </div>
      </div>

      {/* Always-visible delete affordance. On mobile there's no hover, so the
          old opacity-0 group-hover:opacity-100 pattern made delete invisible
          there. Now it's a small but tappable trash icon in the corner. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDeleteModalOpen(true);
        }}
        aria-label={t("wardrobe.delete")}
        className="absolute left-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-red-500/90 text-white shadow-lg backdrop-blur-md transition-all hover:bg-red-600 hover:scale-110 focus-visible:ring-2 focus-visible:ring-red-500/60"
      >
        <Trash2 size={18} strokeWidth={2.5} />
      </button>

      {deleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-title-${item.id}`}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-4 py-6 backdrop-blur-sm sm:items-center"
          onClick={() => !deleting && setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/[0.06] bg-[var(--bg-surface)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/12 text-[var(--danger)]">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id={`delete-title-${item.id}`}
                  className="text-sm font-semibold text-[var(--text-primary)]"
                >
                  {t("wardrobe.deleteTitle")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t("wardrobe.deleteBody")}
                </p>
              </div>
            </div>

            <div className="my-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <img
                src={item.thumbnailUrl ?? item.imageUrl}
                alt=""
                className="h-14 w-12 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {item.subcategory ?? t(`categories.${item.category}`)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {item.colorPrimary} · {item.pattern}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="ghost-action flex-1 rounded-full px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 rounded-full bg-[var(--danger)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--danger)]/90 disabled:opacity-50"
              >
                {deleting ? t("import.saving") : t("wardrobe.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            className="absolute right-2 top-2 text-white/60 hover:text-white"
          >
            ✕
          </button>
          <div className="space-y-1 text-xs text-white/90">
            {needsReview && (
              <p className="mb-2 rounded-xl border border-amber-300/30 bg-amber-300/12 p-2 text-amber-100">
                <span className="font-semibold">{t("tagEditor.needsReview")}:</span>{" "}
                {t("tagEditor.lowConfidenceHint")}
              </p>
            )}
            <p>
              <span className="font-semibold text-[var(--accent)]">{t("wardrobe.category")}:</span>{" "}
              {t(`categories.${item.category}`)}
              {item.subcategory && ` / ${item.subcategory}`}
            </p>
            <p>
              <span className="font-semibold text-[var(--accent)]">{t("wardrobe.color")}:</span> {item.colorPrimary}
            </p>
            <p>
              <span className="font-semibold text-[var(--accent)]">{t("wardrobe.pattern")}:</span> {item.pattern}
            </p>
            {item.fabric && (
              <p>
                <span className="font-semibold text-[var(--accent)]">{t("wardrobe.fabric")}:</span> {item.fabric}
              </p>
            )}
            <p>
              <span className="font-semibold text-[var(--accent)]">{t("wardrobe.season")}:</span>{" "}
              {t(`seasons.${item.season}`)}
            </p>
            <p>
              <span className="font-semibold text-[var(--accent)]">{t("wardrobe.formality")}:</span>{" "}
              {"⬛".repeat(item.formalityLevel)}
              {"⬜".repeat(5 - item.formalityLevel)}
            </p>
            <p>
              <span className="font-semibold text-[var(--accent)]">{t("wardrobe.timesWorn")}:</span> {item.timesWorn}{" "}
              {t("common.times")}
            </p>
          </div>
        </div>
      )}
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
  const navigate = useNavigate();

  const loadItems = useCallback(async () => {
    try {
      const data = await wardrobeApi.getAll();
      // Normalize legacy values defensively (server already does, but in case
      // an older row slips through a non-canonical name, the UI should still
      // route correctly).
      setItems(data.map((it) => ({ ...it, category: normalizeCategory(it.category) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = useCallback(
    async (itemId: string) => {
      try {
        await wardrobeApi.deleteItem(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (e) {
        setError(e instanceof Error ? e.message : t("common.error"));
      }
    },
    [t],
  );

  const handleCategoryChange = useCallback(
    async (itemId: string, newCategory: string) => {
      // Optimistic update
      const previous = items;
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, category: newCategory } : i)),
      );
      try {
        await wardrobeApi.updateItem(itemId, { category: newCategory });
      } catch (e) {
        setItems(previous);
        setError(e instanceof Error ? e.message : t("common.error"));
      }
    },
    [items, t],
  );

  const handleSharingChange = useCallback(
    async (itemId: string, sharedWithFamily: boolean) => {
      const previous = items;
      setItems((current) =>
        current.map((item) =>
          item.id === itemId ? { ...item, sharedWithFamily } : item,
        ),
      );
      try {
        await wardrobeApi.updateItem(itemId, { sharedWithFamily });
      } catch (cause) {
        setItems(previous);
        setError(cause instanceof Error ? cause.message : t("common.error"));
      }
    },
    [items, t],
  );

  const filtered = items.filter((item) => {
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
  });

  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

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
      <div className="mb-6 flex items-center justify-between">
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
                <ItemCard
                  key={item.id}
                  item={item}
                  onDelete={handleDelete}
                  onCategoryChange={handleCategoryChange}
                  onSharingChange={handleSharingChange}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
