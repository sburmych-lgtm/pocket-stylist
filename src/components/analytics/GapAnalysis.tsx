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
  over: "bg-amber-100 text-amber-700",
  under: "bg-blue-100 text-blue-700",
  ok: "bg-green-100 text-green-700",
};

const STATUS_LABELS = {
  over: "Overstocked",
  under: "Gap",
  ok: "Balanced",
};

export function GapAnalysis({ gaps, distribution }: GapAnalysisProps) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-3">
        <h3 className="font-semibold text-neutral-800">Wardrobe Balance</h3>
        <p className="text-xs text-neutral-400">Your distribution vs. ideal wardrobe</p>
      </div>

      {/* Bar chart */}
      <div className="space-y-2 px-5 pt-4 pb-2">
        {distribution.map((d) => (
          <div key={d.category} className="flex items-center gap-2">
            <span className="w-20 text-right text-xs text-neutral-500 capitalize">
              {d.category}
            </span>
            <div className="flex-1">
              <div
                className="h-4 rounded-full bg-indigo-400 transition-all"
                style={{ width: `${(d.count / maxCount) * 100}%`, minWidth: d.count > 0 ? "8px" : "0" }}
              />
            </div>
            <span className="w-8 text-right text-xs font-medium text-neutral-600">
              {d.count}
            </span>
          </div>
        ))}
      </div>

      {/* Gap badges */}
      <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-5 py-3">
        {gaps.map((gap) => (
          <span
            key={gap.category}
            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[gap.status]}`}
          >
            {gap.category}: {STATUS_LABELS[gap.status]}
            {gap.status !== "ok" && ` (${gap.diff > 0 ? "+" : ""}${gap.diff}%)`}
          </span>
        ))}
      </div>
    </div>
  );
}
