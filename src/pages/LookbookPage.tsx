import { useState, useCallback } from "react";
import { CalendarDays, LoaderCircle, RefreshCcw, Sparkles } from "lucide-react";
import { lookbookApi } from "../services/api";
import type { LookbookDay } from "../services/api";
import { useI18n } from "../i18n";

function formatDate(dateStr: string, dayNames: string[]): { dayName: string; display: string } {
  const date = new Date(`${dateStr}T00:00:00`);
  const dayName = dayNames[date.getDay()];
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return { dayName, display: `${dd}.${mm}` };
}

function weatherIcon(condition: string): string {
  switch (condition) {
    case "Clear":
      return "☀";
    case "Clouds":
      return "☁";
    case "Rain":
      return "☂";
    case "Snow":
      return "✦";
    case "Drizzle":
      return "☔";
    case "Thunderstorm":
      return "⚡";
    default:
      return "◐";
  }
}

interface DayCardProps {
  day: LookbookDay;
  index: number;
  onWear: (index: number) => void;
  onRegenerate: (index: number) => void;
  wornDays: Set<number>;
  regenerating: number | null;
}

function DayCard({ day, index, onWear, onRegenerate, wornDays, regenerating }: DayCardProps) {
  const { t } = useI18n();
  const dayNames = [
    t("lookbook.daySun"), t("lookbook.dayMon"), t("lookbook.dayTue"),
    t("lookbook.dayWed"), t("lookbook.dayThu"), t("lookbook.dayFri"), t("lookbook.daySat"),
  ];
  const { dayName, display } = formatDate(day.date, dayNames);
  const isWorn = wornDays.has(index);
  const isRegenerating = regenerating === index;

  return (
    <article className="luxe-card flex w-[20rem] shrink-0 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-subtitle">{t("lookbook.dayEdit")}</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {dayName}
            <span className="ml-2 text-base font-medium text-[var(--text-secondary)]">{display}</span>
          </h3>
        </div>
        <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-secondary)]">
          {weatherIcon(day.weather.condition)} {Math.round(day.weather.temp)}°
        </div>
      </div>

      {day.outfit ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {day.outfit.items.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-[1rem] border border-white/8 bg-white/[0.03]">
                {item.imageUrl.startsWith("data:") || item.imageUrl.startsWith("http") ? (
                  <img
                    src={item.thumbnailUrl ?? item.imageUrl}
                    alt={item.category}
                    className="aspect-[4/5] h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center text-xs text-[var(--text-muted)]">
                    {item.subcategory ?? item.category}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
            {day.outfit.stylingTip}
          </p>
        </>
      ) : (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-[1.3rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-sm text-[var(--text-secondary)]">
          {t("lookbook.noOutfit")}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {day.outfit && (
          <button
            type="button"
            onClick={() => onWear(index)}
            disabled={isWorn}
            className={[
              "inline-flex flex-1 items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition-all",
              isWorn
                ? "bg-[rgba(111,212,171,0.12)] text-[var(--success)]"
                : "primary-action",
            ].join(" ")}
          >
            {isWorn ? t("lookbook.worn") : t("lookbook.willWear")}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRegenerate(index)}
          disabled={isRegenerating}
          className="ghost-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-50"
          title={t("lookbook.altOption")}
        >
          {isRegenerating ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
        </button>
      </div>
    </article>
  );
}

export function LookbookPage() {
  const { t } = useI18n();
  const [days, setDays] = useState<LookbookDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wornDays, setWornDays] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWornDays(new Set());

    try {
      const result = await lookbookApi.generate();
      setDays(result.days);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleWear = useCallback(
    async (index: number) => {
      if (!days || !days[index]?.outfit) {
        return;
      }
      const outfit = days[index].outfit!;
      const itemIds = outfit.items.map((item) => item.id);

      try {
        await lookbookApi.logWear(index, itemIds);
        setWornDays((prev) => new Set([...prev, index]));
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [days],
  );

  const handleRegenerate = useCallback(
    async (index: number) => {
      if (!days) {
        return;
      }
      setRegenerating(index);

      try {
        const currentItems = days[index]?.outfit?.items.map((item) => item.id) ?? [];
        const result = await lookbookApi.regenerateDay(index, currentItems);

        setDays((prev) => {
          if (!prev) {
            return prev;
          }
          const updated = [...prev];
          updated[index] = { ...updated[index], outfit: result.outfit };
          return updated;
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setRegenerating(null);
      }
    },
    [days],
  );

  return (
    <div className="page-shell space-y-8">
      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-5">
            <span className="page-kicker">
              <CalendarDays size={14} />
              {t("lookbook.kicker")}
            </span>
            <h1 className="page-title">
              {t("lookbook.heading").split("\n").map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </h1>
            <p className="page-copy">
              {t("lookbook.description")}
            </p>
          </div>

          <div className="luxe-card p-6">
            <p className="section-subtitle">{t("lookbook.promise")}</p>
            <div className="mt-5 space-y-3">
              {[t("lookbook.promise1"), t("lookbook.promise2"), t("lookbook.promise3")].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <Sparkles size={15} className="mt-1 text-[var(--accent)]" />
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="section-subtitle">{t("lookbook.weeklyGenerator")}</p>
          <h2 className="section-title mt-2">{t("lookbook.createPlan")}</h2>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
        >
          {loading ? <LoaderCircle size={15} className="animate-spin" /> : <CalendarDays size={15} />}
          {loading ? t("lookbook.generating") : days ? t("lookbook.regenerate") : t("lookbook.generate")}
        </button>
      </div>

      {error && <div className="luxe-card border-[rgba(239,138,128,0.22)] p-4 text-sm text-[var(--danger)]">{error}</div>}

      {loading && (
        <section className="luxe-card flex min-h-[18rem] flex-col items-center justify-center gap-4 p-8 text-center">
          <LoaderCircle size={28} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--text-secondary)]">{t("lookbook.generatingOutfits")}</p>
        </section>
      )}

      {!loading && days && days.length > 0 && (
        <section className="space-y-4">
          <div className="editorial-divider" />
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4" style={{ minWidth: "max-content" }}>
              {days.map((day, index) => (
                <DayCard
                  key={day.date}
                  day={day}
                  index={index}
                  onWear={handleWear}
                  onRegenerate={handleRegenerate}
                  wornDays={wornDays}
                  regenerating={regenerating}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {!loading && days && days.length === 0 && (
        <section className="luxe-card p-8 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {t("lookbook.noWardrobe")}
          </p>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {t("lookbook.noWardrobeDesc")}
          </p>
        </section>
      )}

      {!loading && !days && (
        <section className="luxe-card p-10 text-center">
          <p className="section-subtitle">{t("lookbook.readyWhenYouAre")}</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
            {t("lookbook.readyPrompt")}
          </h2>
        </section>
      )}
    </div>
  );
}
