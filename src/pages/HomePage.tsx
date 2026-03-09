import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { wardrobeApi, type WardrobeItem } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Shirt,
  FolderOpen,
  Repeat,
  Trophy,
  Camera,
  Sparkles,
  ScanLine,
  Calendar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ---------- Quick stat card ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`glass-card flex items-center gap-3 p-4 ${
        onClick ? "glass-card-hover cursor-pointer" : ""
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a55a]/10">
        <Icon size={20} className="text-[#c9a55a]" />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-xl font-bold text-[#f0ece4]">{value}</p>
        <p className="truncate text-xs text-[#f0ece4]/45">{label}</p>
      </div>
    </Tag>
  );
}

/* ---------- Quick action ---------- */

function ActionCard({
  icon: Icon,
  title,
  description,
  to,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="glass-card glass-card-hover flex items-start gap-3 p-4 text-left"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c9a55a]/10">
        <Icon size={20} className="text-[#c9a55a]" />
      </div>
      <div>
        <p className="font-semibold text-[#f0ece4]">{title}</p>
        <p className="text-xs text-[#f0ece4]/45">{description}</p>
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#f0ece4]/45">
          Нещодавно додані
        </h2>
        <button
          type="button"
          onClick={() => navigate("/wardrobe")}
          className="text-sm font-medium text-[#c9a55a] transition-colors hover:text-[#dbb978]"
        >
          Переглянути все →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className="w-20 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-[#1a1a2e]"
          >
            <div className="aspect-[3/4] bg-white/[0.03]">
              <img
                src={item.thumbnailUrl ?? item.imageUrl}
                alt={item.category}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="truncate px-1 py-0.5 text-center text-[10px] text-[#f0ece4]/45">
              {item.subcategory ?? item.category}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Skeleton loader ---------- */

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-[72px]" />
      ))}
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
      <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[#c9a55a]">
          Привіт, {user?.name ?? "стилісте"}!
        </h1>
        <p className="mt-1 text-[#f0ece4]/45">
          Ваш AI-асистент по гардеробу готовий до роботи.
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <>
          <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Shirt}
              label="Речей у гардеробі"
              value={items.length}
              onClick={() => navigate("/wardrobe")}
            />
            <StatCard
              icon={FolderOpen}
              label="Категорій"
              value={Object.keys(categories).length}
            />
            <StatCard icon={Repeat} label="Разів одягнено" value={totalWorn} />
            <StatCard
              icon={Trophy}
              label="Топ категорія"
              value={topCategories[0]?.[0] ?? "—"}
            />
          </div>

          {/* Recent items */}
          <RecentItems items={items} />

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[#c9a55a]/20 p-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9a55a]/10">
                <Camera size={32} className="text-[#c9a55a]" />
              </div>
              <h3 className="text-lg font-semibold text-[#f0ece4]">
                Почніть з завантаження одягу
              </h3>
              <p className="max-w-sm text-sm text-[#f0ece4]/45">
                Сфотографуйте свій одяг — AI проаналізує кожну річ та збереже у
                ваш цифровий гардероб.
              </p>
              <button
                type="button"
                onClick={() => navigate("/import")}
                className="gold-btn px-6 py-2.5 text-sm"
              >
                Завантажити фото
              </button>
            </div>
          )}
        </>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#f0ece4]/45">
          Швидкі дії
        </h2>
        <div className="stagger-children grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon={Camera}
            title="Завантажити одяг"
            description="Додайте нові речі до гардеробу"
            to="/import"
          />
          <ActionCard
            icon={Sparkles}
            title="Підібрати образ"
            description="AI підбере look під ваш настрій"
            to="/style"
          />
          <ActionCard
            icon={ScanLine}
            title="Сканер у магазині"
            description="Перевірте чи варто купувати річ"
            to="/scan"
          />
          <ActionCard
            icon={Calendar}
            title="Лукбук на тиждень"
            description="Образи на 7 днів з урахуванням погоди"
            to="/lookbook"
          />
        </div>
      </div>
    </div>
  );
}
