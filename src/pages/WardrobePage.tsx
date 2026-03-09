import { useState, useEffect, useCallback } from "react";
import { wardrobeApi, type WardrobeItem } from "../services/api";
import { useNavigate } from "react-router-dom";

/* ---------- Category config ---------- */

const CATEGORIES = [
  { key: "all", label: "Все", icon: "👗" },
  { key: "tops", label: "Верх", icon: "👕" },
  { key: "bottoms", label: "Низ", icon: "👖" },
  { key: "dresses", label: "Сукні", icon: "👗" },
  { key: "outerwear", label: "Верхній одяг", icon: "🧥" },
  { key: "shoes", label: "Взуття", icon: "👟" },
  { key: "accessories", label: "Аксесуари", icon: "👜" },
  { key: "activewear", label: "Спортивне", icon: "🏃" },
  { key: "swimwear", label: "Купальне", icon: "🩱" },
  { key: "suits", label: "Костюми", icon: "🤵" },
] as const;

const SEASON_LABELS: Record<string, string> = {
  all: "Усі сезони",
  spring: "Весна",
  summer: "Літо",
  fall: "Осінь",
  winter: "Зима",
};

/* ---------- Item card ---------- */

function ItemCard({
  item,
  onDelete,
}: {
  item: WardrobeItem;
  onDelete: (id: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="block aspect-[3/4] w-full overflow-hidden bg-neutral-100"
      >
        <img
          src={item.thumbnailUrl ?? item.imageUrl}
          alt={item.category}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </button>

      {/* Quick info */}
      <div className="p-2">
        <div className="flex items-center gap-1.5">
          {item.colorHex && (
            <span
              className="inline-block h-3 w-3 rounded-full border border-neutral-200"
              style={{ backgroundColor: item.colorHex }}
            />
          )}
          <span className="truncate text-xs font-medium text-neutral-700">
            {item.subcategory ?? item.category}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-400">
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

      {/* Delete button */}
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
            ? "bg-red-600 text-white"
            : "bg-black/40 text-white hover:bg-red-600"
        }`}
      >
        {confirmDelete ? "Видалити?" : "✕"}
      </button>

      {/* Details overlay */}
      {showDetails && (
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            className="absolute right-2 top-2 text-white/80 hover:text-white"
          >
            ✕
          </button>
          <div className="space-y-1 text-xs text-white">
            <p>
              <span className="font-semibold">Категорія:</span> {item.category}
              {item.subcategory && ` / ${item.subcategory}`}
            </p>
            <p>
              <span className="font-semibold">Колір:</span> {item.colorPrimary}
            </p>
            <p>
              <span className="font-semibold">Візерунок:</span> {item.pattern}
            </p>
            {item.fabric && (
              <p>
                <span className="font-semibold">Тканина:</span> {item.fabric}
              </p>
            )}
            <p>
              <span className="font-semibold">Сезон:</span>{" "}
              {SEASON_LABELS[item.season] ?? item.season}
            </p>
            <p>
              <span className="font-semibold">Формальність:</span>{" "}
              {"⬛".repeat(item.formalityLevel)}
              {"⬜".repeat(5 - item.formalityLevel)}
            </p>
            <p>
              <span className="font-semibold">Носили:</span> {item.timesWorn}{" "}
              раз
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Empty state ---------- */

function EmptyWardrobe() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 p-12 text-center">
      <div className="text-5xl">👗</div>
      <h3 className="text-lg font-semibold text-neutral-700">
        Ваш гардероб порожній
      </h3>
      <p className="max-w-sm text-sm text-neutral-500">
        Завантажте фото свого одягу, і AI проаналізує кожну річ — категорію,
        колір, тканину, сезон.
      </p>
      <button
        type="button"
        onClick={() => navigate("/import")}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Завантажити одяг
      </button>
    </div>
  );
}

/* ---------- Main page ---------- */

export function WardrobePage() {
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
      setError(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = useCallback(
    async (itemId: string) => {
      try {
        await wardrobeApi.deleteItem(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка видалення");
      }
    },
    [],
  );

  /* Filtering */
  const filtered = items.filter((item) => {
    if (activeCategory !== "all" && item.category !== activeCategory)
      return false;
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

  /* Category counts */
  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            👗 Мій гардероб
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {items.length} {items.length === 1 ? "річ" : items.length < 5 ? "речі" : "речей"}{" "}
            в гардеробі
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/import")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Додати одяг
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyWardrobe />
      ) : (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Шукати по назві, кольору, бренду..."
              className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Category tabs */}
          <div className="mb-6 flex gap-1 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => {
              const count =
                cat.key === "all" ? items.length : (categoryCounts[cat.key] ?? 0);
              if (cat.key !== "all" && count === 0) return null;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeCategory === cat.key
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      activeCategory === cat.key
                        ? "bg-white/20 text-white"
                        : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Items grid */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
              <p className="text-neutral-400">
                {searchQuery
                  ? "Нічого не знайдено за запитом"
                  : "Немає речей у цій категорії"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
