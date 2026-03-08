import { useState, useCallback } from "react";
import { lookbookApi } from "../services/api";
import type { LookbookDay } from "../services/api";

const DAY_NAMES_UK = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function formatDate(dateStr: string): { dayName: string; display: string } {
  const date = new Date(dateStr + "T00:00:00");
  const dayName = DAY_NAMES_UK[date.getDay()];
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return { dayName, display: `${dd}.${mm}` };
}

function weatherIcon(condition: string): string {
  switch (condition) {
    case "Clear": return "\u2600\uFE0F";
    case "Clouds": return "\u2601\uFE0F";
    case "Rain": return "\uD83C\uDF27\uFE0F";
    case "Snow": return "\u2744\uFE0F";
    case "Drizzle": return "\uD83C\uDF26\uFE0F";
    case "Thunderstorm": return "\u26C8\uFE0F";
    default: return "\uD83C\uDF24\uFE0F";
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
  const { dayName, display } = formatDate(day.date);
  const isWorn = wornDays.has(index);
  const isRegenerating = regenerating === index;

  return (
    <div className="flex w-64 flex-shrink-0 flex-col rounded-xl border border-neutral-200 bg-white p-4">
      {/* Header: day + weather */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-lg font-bold text-neutral-800">{dayName}</span>
          <span className="ml-1 text-sm text-neutral-500">{display}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xl">{weatherIcon(day.weather.condition)}</span>
          <span className="text-sm font-medium text-neutral-700">
            {Math.round(day.weather.temp)}{"\u00B0"}
          </span>
        </div>
      </div>

      {/* Outfit items */}
      {day.outfit ? (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {day.outfit.items.map((item) => (
              <div key={item.id} className="flex-shrink-0">
                <div className="h-16 w-14 overflow-hidden rounded-lg bg-neutral-100">
                  {item.imageUrl.startsWith("data:") || item.imageUrl.startsWith("http") ? (
                    <img
                      src={item.thumbnailUrl ?? item.imageUrl}
                      alt={item.category}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                      {item.subcategory ?? item.category}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mb-3 line-clamp-2 text-xs text-neutral-500">
            {day.outfit.stylingTip}
          </p>
        </>
      ) : (
        <div className="mb-3 flex flex-1 items-center justify-center py-6 text-sm text-neutral-400">
          Немає аутфіту
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2">
        {day.outfit && (
          <button
            type="button"
            onClick={() => onWear(index)}
            disabled={isWorn}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              isWorn
                ? "bg-emerald-100 text-emerald-700"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {isWorn ? "\u2713 Вдягнено" : "Вдягну"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRegenerate(index)}
          disabled={isRegenerating}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium
            text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          title="Інший варіант"
        >
          {isRegenerating ? "\u23F3" : "\uD83D\uDD04"}
        </button>
      </div>
    </div>
  );
}

export function LookbookPage() {
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
      if (!days || !days[index]?.outfit) return;
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
      if (!days) return;
      setRegenerating(index);

      try {
        // Exclude current outfit items to get a different suggestion
        const currentItems = days[index]?.outfit?.items.map((i) => i.id) ?? [];
        const result = await lookbookApi.regenerateDay(index, currentItems);

        setDays((prev) => {
          if (!prev) return prev;
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Lookbook
          </h1>
          <p className="mt-1 text-neutral-500">
            Аутфіти на тиждень з урахуванням погоди.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold
            text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Генерую..." : days ? "Перегенерувати" : "Згенерувати тиждень"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-neutral-500">
              Генерую аутфіти на 7 днів...
            </p>
          </div>
        </div>
      )}

      {!loading && days && days.length > 0 && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: "max-content" }}>
            {days.map((day, i) => (
              <DayCard
                key={day.date}
                day={day}
                index={i}
                onWear={handleWear}
                onRegenerate={handleRegenerate}
                wornDays={wornDays}
                regenerating={regenerating}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && days && days.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-neutral-500">
            Немає речей у гардеробі. Спершу імпортуйте одяг.
          </p>
        </div>
      )}

      {!loading && !days && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
          <p className="text-lg text-neutral-400">
            {"\uD83D\uDCC5"} Натисніть "Згенерувати тиждень" щоб отримати план аутфітів
          </p>
        </div>
      )}
    </div>
  );
}
