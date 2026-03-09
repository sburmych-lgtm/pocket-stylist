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
  CalendarDays,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  caption: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "luxe-card flex w-full items-start gap-4 p-5 text-left",
        onClick ? "luxe-card-hover cursor-pointer" : "",
      ].join(" ")}
    >
      <div className="spotlight-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(214,177,111,0.1)] text-[var(--accent)]">
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="section-subtitle">{label}</p>
        <p className="mt-2 text-3xl font-bold leading-none text-[var(--text-primary)]">
          {value}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{caption}</p>
      </div>
    </Tag>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  eyebrow,
  to,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow: string;
  to: string;
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="luxe-card luxe-card-hover group flex h-full flex-col items-start gap-5 p-5 text-left"
    >
      <div className="flex w-full items-start justify-between">
        <div className="spotlight-ring flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(214,177,111,0.1)] text-[var(--accent)]">
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <span className="section-subtitle text-[0.65rem]">{eyebrow}</span>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
        Відкрити
        <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function RecentItems({ items }: { items: WardrobeItem[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="luxe-card p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="section-subtitle">Newest Additions</p>
          <h2 className="section-title mt-2">Останні curated pieces</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate("/wardrobe")}
          className="ghost-action px-4 py-2 text-sm"
        >
          Весь гардероб
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, 8).map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-[1.35rem] border border-white/8 bg-white/[0.03]"
          >
            <div className="aspect-[4/5] overflow-hidden">
              <img
                src={item.thumbnailUrl ?? item.imageUrl}
                alt={item.category}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
            </div>
            <div className="space-y-1 px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {item.subcategory ?? item.category}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {item.colorPrimary}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="skeleton h-40" />
      ))}
    </div>
  );
}

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

  const categories = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalWorn = items.reduce((sum, item) => sum + item.timesWorn, 0);

  return (
    <div className="page-shell space-y-8">
      <section className="page-header animate-fade-in-up p-6 sm:p-8">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <span className="page-kicker">Personal Styling Suite</span>
            <div className="space-y-4">
              <h1 className="page-title">
                {user?.name ?? "Stylist"}, ваш гардероб
                <br />
                готовий до нового сезону.
              </h1>
              <p className="page-copy">
                Обʼєднуємо wardrobe intelligence, атмосферу luxury editorial і AI-підбір
                образів в одному цифровому atelier.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/style")}
                className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm"
              >
                Створити образ
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/import")}
                className="ghost-action px-5 py-3 text-sm"
              >
                Додати нові речі
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="metric-pill">
                <Sparkles size={14} className="text-[var(--accent)]" />
                AI look curation
              </span>
              <span className="metric-pill">
                <BarChart3 size={14} className="text-[var(--accent-cool)]" />
                Wear analytics
              </span>
              <span className="metric-pill">
                <CalendarDays size={14} className="text-[var(--accent)]" />
                Weekly lookbook
              </span>
            </div>
          </div>

          <div className="luxe-card flex flex-col justify-between gap-6 p-6">
            <div className="space-y-3">
              <p className="section-subtitle">Style Outlook</p>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {items.length > 0
                  ? "Ваш гардероб уже формує сильний fashion language."
                  : "Почнімо з першої curated добірки речей."}
              </p>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                {items.length > 0
                  ? "Ми бачимо ваші найсильніші категорії, звички носіння й готові побудувати smarter rotation."
                  : "Завантажте кілька фото, а ми перетворимо їх на структурований гардероб із підказками для стилю."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">Top Focus</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                  {topCategories[0]?.[0] ?? "Curate"}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {topCategories[0]
                    ? `${topCategories[0][1]} позицій у головній категорії`
                    : "Перший імпорт відкриє персональний стиль-профіль."}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">Wear Rhythm</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                  {totalWorn}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  зафіксованих носінь у вашій fashion memory.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <StatsSkeleton />
      ) : (
        <>
          <section className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Shirt}
              label="Collection"
              value={items.length}
              caption="Предметів у вашому digital wardrobe."
              onClick={() => navigate("/wardrobe")}
            />
            <StatCard
              icon={FolderOpen}
              label="Categories"
              value={Object.keys(categories).length}
              caption="Сильна капсула працює через баланс категорій."
            />
            <StatCard
              icon={Repeat}
              label="Wear Count"
              value={totalWorn}
              caption="Кожне носіння формує реальну цінність речей."
            />
            <StatCard
              icon={Trophy}
              label="Hero Category"
              value={topCategories[0]?.[0] ?? "—"}
              caption="Категорія, що зараз визначає ваш стиль."
            />
          </section>

          {items.length === 0 ? (
            <section className="page-header p-8 text-center">
              <div className="relative z-10 mx-auto max-w-2xl space-y-5">
                <div className="spotlight-ring mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(214,177,111,0.12)] text-[var(--accent)]">
                  <Camera size={34} strokeWidth={2.1} />
                </div>
                <div>
                  <p className="section-subtitle">First Curation</p>
                  <h2 className="page-title text-[clamp(2rem,5vw,3.2rem)]">
                    Створіть основу свого
                    <br />
                    premium wardrobe profile.
                  </h2>
                </div>
                <p className="mx-auto page-copy">
                  Завантажте кілька фото одягу, і ми миттєво підготуємо цифровий каталог,
                  готовий до styling, scanner verdicts і weekly planning.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/import")}
                    className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm"
                  >
                    Почати імпорт
                    <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/scan")}
                    className="ghost-action px-5 py-3 text-sm"
                  >
                    Спробувати сканер
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <>
              <RecentItems items={items} />

              <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="luxe-card p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="section-subtitle">Wardrobe Signals</p>
                      <h2 className="section-title mt-2">Що зараз домінує у вашому стилі</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/analytics")}
                      className="ghost-action px-4 py-2 text-sm"
                    >
                      Відкрити аналітику
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {topCategories.map(([category, count]) => (
                      <div
                        key={category}
                        className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4"
                      >
                        <p className="section-subtitle">Category</p>
                        <p className="mt-3 text-2xl font-semibold capitalize text-[var(--text-primary)]">
                          {category}
                        </p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          {count} curated pieces already define this direction.
                        </p>
                      </div>
                    ))}
                    {topCategories.length === 0 && (
                      <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-[var(--text-secondary)]">
                        Додайте речі, щоб побачити стилістичний профіль.
                      </div>
                    )}
                  </div>
                </div>

                <div className="luxe-card p-6">
                  <p className="section-subtitle">Next Move</p>
                  <h2 className="section-title mt-2">Підсильте систему рекомендацій</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    Що більше контексту ми знаємо про речі, тим точніше працюють matching,
                    analytics і AI-composed outfits.
                  </p>

                  <div className="mt-5 space-y-3">
                    {[
                      "Завантажте нову капсулу для richer AI profile.",
                      "Відмічайте wear logs для accurate cost-per-wear.",
                      "Зберіть weekly lookbook, щоб побачити прогалини.",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                      >
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      <section className="space-y-4">
        <div>
          <p className="section-subtitle">Atelier Shortcuts</p>
          <h2 className="section-title mt-2">Швидкі fashion-сценарії</h2>
        </div>

        <div className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            icon={Camera}
            eyebrow="Import"
            title="Curate new arrivals"
            description="Додайте нові речі й миттєво отримайте AI-теги, матеріали та сезонність."
            to="/import"
          />
          <ActionCard
            icon={Sparkles}
            eyebrow="Style Me"
            title="Generate three looks"
            description="Підберіть образи за настроєм, формальністю й погодним контекстом."
            to="/style"
          />
          <ActionCard
            icon={ScanLine}
            eyebrow="Scanner"
            title="Decode store finds"
            description="Оцініть нову покупку через BUY/SKIP verdict і fit до вашого гардеробу."
            to="/scan"
          />
          <ActionCard
            icon={CalendarDays}
            eyebrow="Lookbook"
            title="Build a weekly edit"
            description="Створіть тижневу fashion-rotation, щоб носити гардероб розумніше."
            to="/lookbook"
          />
        </div>
      </section>
    </div>
  );
}
