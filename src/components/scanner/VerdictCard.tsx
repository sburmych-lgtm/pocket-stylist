interface VerdictCardProps {
  verdict: "BUY" | "SKIP" | "CONSIDER";
  reasons: string[];
  tags: {
    category: string;
    subcategory: string;
    colorPrimary: string;
    colorHex: string;
    pattern: string;
    fabric: string;
    formalityLevel: number;
    confidence: number;
  };
  stats: {
    sameCategoryCount: number;
    sameColorCount: number;
    newOutfitPotential: number;
    projectedCostPerWear: string;
    avgWearsInWardrobe: number;
  };
}

export function VerdictCard({ verdict, reasons, tags, stats }: VerdictCardProps) {
  const verdictStyles = {
    BUY: "border-emerald-500/30 bg-emerald-500/10",
    SKIP: "border-red-500/30 bg-red-500/10",
    CONSIDER: "border-[#c9a55a]/30 bg-[#c9a55a]/10",
  };

  const verdictEmoji = {
    BUY: "\u2705",
    SKIP: "\u274C",
    CONSIDER: "\uD83E\uDD14",
  };

  const verdictText = {
    BUY: "text-emerald-400",
    SKIP: "text-red-400",
    CONSIDER: "text-[#c9a55a]",
  };

  return (
    <div className={`rounded-2xl border-2 p-6 ${verdictStyles[verdict]}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-4xl">{verdictEmoji[verdict]}</span>
        <div>
          <h2 className={`text-2xl font-bold ${verdictText[verdict]}`}>
            {verdict}
          </h2>
          <p className="text-sm text-[#f0ece4]/55">
            {tags.colorPrimary} {tags.subcategory ?? tags.category} \u00B7 {tags.pattern} \u00B7 {tags.fabric ?? "unknown fabric"}
          </p>
        </div>
        {tags.colorHex && (
          <span className="ml-auto h-8 w-8 rounded-full border-2 border-white/10 shadow-lg"
            style={{ backgroundColor: tags.colorHex }} />
        )}
      </div>

      <div className="mb-4 space-y-1">
        {reasons.map((reason, i) => (
          <p key={i} className="text-sm text-[#f0ece4]/70">
            \u2022 {reason}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Та ж категорія" value={String(stats.sameCategoryCount)} />
        <StatBox label="Той же колір" value={String(stats.sameColorCount)} />
        <StatBox label="Нові образи" value={`${stats.newOutfitPotential}+`} />
        <StatBox label="Ціна/носіння" value={stats.projectedCostPerWear} />
      </div>

      <div className="mt-3 text-xs text-[#f0ece4]/35">
        Впевненість: {Math.round(tags.confidence * 100)}% \u00B7 Формальність: {tags.formalityLevel}/5
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.05] p-2 text-center">
      <p className="text-lg font-semibold text-[#f0ece4]">{value}</p>
      <p className="text-xs text-[#f0ece4]/45">{label}</p>
    </div>
  );
}
