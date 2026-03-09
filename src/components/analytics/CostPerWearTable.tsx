import { useI18n } from "../../i18n";

interface CostPerWearItem {
  id: string;
  category: string;
  subcategory: string | null;
  colorPrimary: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  price: number | null;
  timesWorn: number;
  costPerWear: number | null;
  daysSincePurchase: number;
}

interface CostPerWearTableProps {
  items: CostPerWearItem[];
}

export function CostPerWearTable({ items }: CostPerWearTableProps) {
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <section className="luxe-card p-6 text-center text-sm text-[var(--text-secondary)]">
        {t("analytics.costEmpty")}
      </section>
    );
  }

  return (
    <section className="luxe-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-subtitle">{t("analytics.costIntelKicker")}</p>
          <h3 className="section-title mt-2">{t("analytics.costIntelTitle")}</h3>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.slice(0, 10).map((item) => (
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
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {item.colorPrimary} · {t("analytics.wears", { count: item.timesWorn })}
              </p>
            </div>
            <div className="text-left sm:text-right">
              {item.costPerWear != null ? (
                <>
                  <p
                    className={[
                      "text-lg font-semibold",
                      item.costPerWear > 20
                        ? "text-[var(--danger)]"
                        : item.costPerWear > 5
                          ? "text-[var(--warning)]"
                          : "text-[var(--success)]",
                    ].join(" ")}
                  >
                    ${item.costPerWear.toFixed(2)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {t("analytics.perWear")}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">{t("analytics.noPrice")}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
