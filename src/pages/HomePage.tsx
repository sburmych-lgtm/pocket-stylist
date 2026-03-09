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
import { useI18n } from "../i18n";

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
      <div className="spotlight-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(201,165,90,0.1)] text-[var(--accent)]">
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
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="luxe-card luxe-card-hover group flex h-full flex-col items-start gap-5 p-5 text-left"
    >
      <div className="flex w-full items-start justify-between">
        <div className="spotlight-ring flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(201,165,90,0.1)] text-[var(--accent)]">
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <span className="section-subtitle text-[0.65rem]">{eyebrow}</span>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
      <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
        {t("common.open")}
        <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function RecentItems({ items }: { items: WardrobeItem[] }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="luxe-card p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="section-subtitle">{t("home.newestAdditions")}</p>
          <h2 className="section-title mt-2">{t("home.latestPieces")}</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate("/wardrobe")}
          className="ghost-action px-4 py-2 text-sm"
        >
          {t("home.fullWardrobe")}
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
  const { t } = useI18n();
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
            <span className="page-kicker">{t("home.kicker")}</span>
            <div className="space-y-4">
              <h1 className="page-title">
                {t("home.heading", { name: user?.name ?? "Stylist" }).split("\n").map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </h1>
              <p className="page-copy">{t("home.description")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/style")}
                className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm"
              >
                {t("home.createOutfit")}
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/import")}
                className="ghost-action px-5 py-3 text-sm"
              >
                {t("home.addNew")}
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="metric-pill">
                <Sparkles size={14} className="text-[var(--accent)]" />
                {t("home.aiCuration")}
              </span>
              <span className="metric-pill">
                <BarChart3 size={14} className="text-[var(--accent-cool)]" />
                {t("home.wearAnalytics")}
              </span>
              <span className="metric-pill">
                <CalendarDays size={14} className="text-[var(--accent)]" />
                {t("home.weeklyLookbook")}
              </span>
            </div>
          </div>

          <div className="luxe-card flex flex-col justify-between gap-6 p-6">
            <div className="space-y-3">
              <p className="section-subtitle">{t("home.styleOutlook")}</p>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {items.length > 0 ? t("home.hasItemsOutlook") : t("home.noItemsOutlook")}
              </p>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                {items.length > 0 ? t("home.hasItemsOutlookDesc") : t("home.noItemsOutlookDesc")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">{t("home.topFocus")}</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
                  {topCategories[0]?.[0] ?? "—"}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {topCategories[0]
                    ? t("home.itemsInCategory", { count: topCategories[0][1] })
                    : t("home.firstImportHint")}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">{t("home.wearRhythm")}</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{totalWorn}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{t("home.recordedWears")}</p>
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
            <StatCard icon={Shirt} label={t("home.collection")} value={items.length} caption={t("home.collectionCaption")} onClick={() => navigate("/wardrobe")} />
            <StatCard icon={FolderOpen} label={t("home.categories")} value={Object.keys(categories).length} caption={t("home.categoriesCaption")} />
            <StatCard icon={Repeat} label={t("home.wearCount")} value={totalWorn} caption={t("home.wearCountCaption")} />
            <StatCard icon={Trophy} label={t("home.heroCategory")} value={topCategories[0]?.[0] ?? "—"} caption={t("home.heroCategoryCaption")} />
          </section>

          {items.length === 0 ? (
            <section className="page-header p-8 text-center">
              <div className="relative z-10 mx-auto max-w-2xl space-y-5">
                <div className="spotlight-ring mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(201,165,90,0.12)] text-[var(--accent)]">
                  <Camera size={34} strokeWidth={2.1} />
                </div>
                <div>
                  <p className="section-subtitle">{t("home.firstCuration")}</p>
                  <h2 className="page-title text-[clamp(2rem,5vw,3.2rem)]">
                    {t("home.firstCurationTitle").split("\n").map((line, i) => (
                      <span key={i}>{i > 0 && <br />}{line}</span>
                    ))}
                  </h2>
                </div>
                <p className="mx-auto page-copy">{t("home.firstCurationDesc")}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={() => navigate("/import")} className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
                    {t("home.startImport")}
                    <ArrowRight size={15} />
                  </button>
                  <button type="button" onClick={() => navigate("/scan")} className="ghost-action px-5 py-3 text-sm">
                    {t("home.tryScanner")}
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
                      <p className="section-subtitle">{t("home.wardrobeSignals")}</p>
                      <h2 className="section-title mt-2">{t("home.currentDominance")}</h2>
                    </div>
                    <button type="button" onClick={() => navigate("/analytics")} className="ghost-action px-4 py-2 text-sm">
                      {t("home.openAnalytics")}
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {topCategories.map(([category, count]) => (
                      <div key={category} className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                        <p className="section-subtitle">{t("home.category")}</p>
                        <p className="mt-3 text-2xl font-semibold capitalize text-[var(--text-primary)]">{category}</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{t("home.categoryPieces", { count })}</p>
                      </div>
                    ))}
                    {topCategories.length === 0 && (
                      <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-[var(--text-secondary)]">
                        {t("home.addItemsHint")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="luxe-card p-6">
                  <p className="section-subtitle">{t("home.nextMove")}</p>
                  <h2 className="section-title mt-2">{t("home.boostRecommendations")}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{t("home.boostDesc")}</p>
                  <div className="mt-5 space-y-3">
                    {[t("home.boostTip1"), t("home.boostTip2"), t("home.boostTip3")].map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
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
          <p className="section-subtitle">{t("home.shortcuts")}</p>
          <h2 className="section-title mt-2">{t("home.shortcutsTitle")}</h2>
        </div>
        <div className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard icon={Camera} eyebrow={t("nav.import")} title={t("home.shortcutImport")} description={t("home.shortcutImportDesc")} to="/import" />
          <ActionCard icon={Sparkles} eyebrow={t("nav.style")} title={t("home.shortcutStyle")} description={t("home.shortcutStyleDesc")} to="/style" />
          <ActionCard icon={ScanLine} eyebrow={t("nav.scanner")} title={t("home.shortcutScan")} description={t("home.shortcutScanDesc")} to="/scan" />
          <ActionCard icon={CalendarDays} eyebrow={t("nav.lookbook")} title={t("home.shortcutLookbook")} description={t("home.shortcutLookbookDesc")} to="/lookbook" />
        </div>
      </section>
    </div>
  );
}
