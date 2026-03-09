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
  over: "bg-amber-500/10 text-amber-400",
  under: "bg-blue-500/10 text-blue-400",
  ok: "bg-emerald-500/10 text-emerald-400",
};

const STATUS_LABELS = {
  over: "Надлишок",
  under: "Нестача",
  ok: "Баланс",
};

export function GapAnalysis({ gaps, distribution }: GapAnalysisProps) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e]">
      <div className="border-b border-white/[0.06] px-5 py-3">
        <h3 className="font-semibold text-[#f0ece4]">Баланс гардеробу</h3>
        <p className="text-xs text-[#f0ece4]/35">Ваш розподіл vs. ідеальний гардероб</p>
      </div>

      <div className="space-y-2 px-5 pb-2 pt-4">
        {distribution.map((d) => (
          <div key={d.category} className="flex items-center gap-2">
            <span className="w-20 text-right text-xs capitalize text-[#f0ece4]/45">
              {d.category}
            </span>
            <div className="flex-1">
              <div className="h-4 rounded-full bg-[#c9a55a] transition-all"
                style={{ width: `${(d.count / maxCount) * 100}%`, minWidth: d.count > 0 ? "8px" : "0" }} />
            </div>
            <span className="w-8 text-right text-xs font-medium text-[#f0ece4]/55">
              {d.count}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-5 py-3">
        {gaps.map((gap) => (
          <span key={gap.category}
            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[gap.status]}`}>
            {gap.category}: {STATUS_LABELS[gap.status]}
            {gap.status !== "ok" && ` (${gap.diff > 0 ? "+" : ""}${gap.diff}%)`}
          </span>
        ))}
      </div>
    </div>
  );
}
