import { useI18n } from "../../i18n";

interface Gap {
  category: string;
  current: number;
  ideal: number;
  diff: number;
  status: "over" | "under" | "ok";
}

interface GapAnalysisProps {
  gaps: Gap[];
  distribution: Array<{ category: string; count: number; percentage: number }>;
}

const STATUS_STYLES = {
  over: "bg-[rgba(241,195,121,0.12)] text-[var(--warning)]",
  under: "bg-[rgba(136,198,189,0.12)] text-[var(--accent-cool)]",
  ok: "bg-[rgba(111,212,171,0.12)] text-[var(--success)]",
};

export function GapAnalysis({ gaps, distribution }: GapAnalysisProps) {
  const { t } = useI18n();
  const maxCount = Math.max(...distribution.map((item) => item.count), 1);

  const statusLabels: Record<string, string> = {
    over: t("analytics.excess"),
    under: t("analytics.deficit"),
    ok: t("analytics.balance"),
  };

  return (
    <section className="luxe-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-subtitle">{t("analytics.gapKicker")}</p>
          <h3 className="section-title mt-2">{t("analytics.gapTitle")}</h3>
        </div>
        <span className="metric-pill">{t("analytics.idealVsCurrent")}</span>
      </div>

      <div className="mt-6 space-y-4">
        {distribution.map((item) => (
          <div key={item.category} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold capitalize text-[var(--text-primary)]">{item.category}</span>
              <span className="text-[var(--text-secondary)]">
                {t("analytics.gapItems", { count: item.count, pct: item.percentage })}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[rgba(201,165,90,0.62)] to-[var(--accent)]"
                style={{ width: `${Math.max((item.count / maxCount) * 100, item.count > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="editorial-divider my-6" />

      <div className="flex flex-wrap gap-2">
        {gaps.map((gap) => (
          <span key={gap.category} className={`status-chip ${STATUS_STYLES[gap.status]}`}>
            {gap.category}: {statusLabels[gap.status]}
            {gap.status !== "ok" ? ` (${gap.diff > 0 ? "+" : ""}${gap.diff}%)` : ""}
          </span>
        ))}
      </div>
    </section>
  );
}
