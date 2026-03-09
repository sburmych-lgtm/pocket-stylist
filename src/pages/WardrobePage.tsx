import { useState, useEffect, useCallback } from "react";
import { wardrobeApi, type WardrobeItem } from "../services/api";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useI18n } from "../i18n";

const CATEGORY_KEYS = [
  "all", "tops", "bottoms", "dresses", "outerwear",
  "shoes", "accessories", "activewear", "swimwear", "suits",
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  all: "👗", tops: "👕", bottoms: "👖", dresses: "👗", outerwear: "🧥",
  shoes: "👟", accessories: "👜", activewear: "🏃", swimwear: "🩱", suits: "🤵",
};

function ItemCard({
  item,
  onDelete,
}: {
  item: WardrobeItem;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1a2e] shadow-lg shadow-black/20 transition-all duration-300 hover:border-white/[0.12] hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5">
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

      <div className="p-2">
        <div className="flex items-center gap-1.5">
          {item.colorHex && (
            <span
              className="inline-block h-3 w-3 rounded-full border border-white/10"
              style={{ backgroundColor: item.colorHex }}
            />
          )}
          <span className="truncate text-xs font-medium text-[#f0ece4]/80">
            {item.subcategory ?? item.category}
          </span>
        </div>
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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (confirmDelete) {
            onDelete(item.id);
          } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
          }
        }}
        className={`absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-xs font-medium opacity-0 transition-all group-hover:opacity-100 ${
          confirmDelete
            ? "bg-red-500 text-white"
            : "bg-black/50 text-white/80 hover:bg-red-500 hover:text-white"
        }`}
      >
        {confirmDelete ? t("wardrobe.deleteConfirm") : "✕"}
      </button>

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
            <p>
              <span className="font-semibold text-[var(--accent)]">{t("wardrobe.category")}:</span> {item.category}
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
      setItems(data);
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
            <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((item) => (
                <ItemCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
