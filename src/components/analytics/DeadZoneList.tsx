import { useI18n } from "../../i18n";

interface DeadZoneItem {
  id: string;
  category: string;
  subcategory: string | null;
  colorPrimary: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  daysSinceWorn: number;
  timesWorn: number;
}

interface DeadZoneListProps {
  items: DeadZoneItem[];
}

export function DeadZoneList({ items }: DeadZoneListProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <section className="luxe-card border-[rgba(111,212,171,0.22)] p-6 text-center text-sm text-[var(--success)]">
        {t("analytics.deadZoneEmpty")}
      </section>
    );
  }

  return (
    <section className="luxe-card p-6">
      <div>
        <p className="section-subtitle">{t("analytics.deadZoneKicker")}</p>
        <h3 className="section-title mt-2">{t("analytics.deadZoneTitle")}</h3>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid gap-4 rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
            <div className="h-16 w-16 overflow-hidden rounded-[1rem] bg-white/[0.05]">
              {(item.thumbnailUrl ?? item.imageUrl).startsWith("data:") ? (
                <img
                  src={item.thumbnailUrl ?? item.imageUrl}
                  alt={item.category}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-muted)]">
                  {item.category.slice(0, 3)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {item.subcategory ?? item.category}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.colorPrimary}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-lg font-semibold text-[var(--danger)]">{item.daysSinceWorn}d</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {item.timesWorn === 0 ? t("analytics.neverWorn") : t("analytics.wears", { count: item.timesWorn })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
