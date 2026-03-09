import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wardrobeApi, type WardrobeItem } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

/* ---------- Quick stat card ---------- */

function StatCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm ${
        onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0 text-left">
        <p className="text-xl font-bold text-neutral-900">{value}</p>
        <p className="truncate text-xs text-neutral-500">{label}</p>
      </div>
    </Tag>
  );
}

/* ---------- Quick action ---------- */

function ActionCard({
  icon,
  title,
  description,
  to,
}: {
  icon: string;
  title: string;
  description: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-semibold text-neutral-800">{title}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
    </button>
  );
}

/* ---------- Recent items strip ---------- */

function RecentItems({ items }: { items: WardrobeItem[] }) {
  const navigate = useNavigate();
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Нещодавно додані
        </h2>
        <button
          type="button"
          onClick={() => navigate("/wardrobe")}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Переглянути все →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white"
          >
            <div className="aspect-[3/4] bg-neutral-100">
              <img
                src={item.thumbnailUrl ?? item.imageUrl}
                alt={item.category}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="truncate px-1 py-0.5 text-center text-[10px] text-neutral-500">
              {item.subcategory ?? item.category}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Main ---------- */

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wardrobeApi
      .getAll()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* Category distribution */
  const categories = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1;
    return acc;
  }, {});
  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalWorn = items.reduce((s, i) => s + i.timesWorn, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Привіт, {user?.name ?? "стилісте"}! 👋
        </h1>
        <p className="mt-1 text-neutral-500">
          Ваш AI-асистент по гардеробу готовий до роботи.
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon="👗"
              label="Речей у гардеробі"
              value={items.length}
              onClick={() => navigate("/wardrobe")}
            />
            <StatCard
              icon="📂"
              label="Категорій"
              value={Object.keys(categories).length}
            />
            <StatCard icon="👔" label="Разів одягнено" value={totalWorn} />
            <StatCard
              icon="🏆"
              label="Топ категорія"
              value={topCategories[0]?.[0] ?? "—"}
            />
          </div>

          {/* Recent items */}
          <RecentItems items={items} />

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 p-10 text-center">
              <div className="text-4xl">📸</div>
              <h3 className="text-lg font-semibold text-neutral-700">
                Почніть з завантаження одягу
              </h3>
              <p className="max-w-sm text-sm text-neutral-500">
                Сфотографуйте свій одяг — AI проаналізує кожну річ та збереже у
                ваш цифровий гардероб.
              </p>
              <button
                type="button"
                onClick={() => navigate("/import")}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Завантажити фото
              </button>
            </div>
          )}
        </>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Швидкі дії
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon="📸"
            title="Завантажити одяг"
            description="Додайте нові речі до гардеробу"
            to="/import"
          />
          <ActionCard
            icon="✨"
            title="Підібрати образ"
            description="AI підбере look під ваш настрій"
            to="/style"
          />
          <ActionCard
            icon="🔍"
            title="Сканер у магазині"
            description="Перевірте чи варто купувати річ"
            to="/scan"
          />
          <ActionCard
            icon="📅"
            title="Лукбук на тиждень"
            description="Образи на 7 днів з урахуванням погоди"
            to="/lookbook"
          />
        </div>
      </div>
    </div>
  );
}
