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
    BUY: "border-green-300 bg-green-50",
    SKIP: "border-red-300 bg-red-50",
    CONSIDER: "border-amber-300 bg-amber-50",
  };

  const verdictEmoji = {
    BUY: "\u2705",
    SKIP: "\u274C",
    CONSIDER: "\uD83E\uDD14",
  };

  const verdictText = {
    BUY: "text-green-800",
    SKIP: "text-red-800",
    CONSIDER: "text-amber-800",
  };

  return (
    <div className={`rounded-2xl border-2 p-6 ${verdictStyles[verdict]}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-4xl">{verdictEmoji[verdict]}</span>
        <div>
          <h2 className={`text-2xl font-bold ${verdictText[verdict]}`}>
            {verdict}
          </h2>
          <p className="text-sm text-neutral-600">
            {tags.colorPrimary} {tags.subcategory ?? tags.category} \u00B7 {tags.pattern} \u00B7 {tags.fabric ?? "unknown fabric"}
          </p>
        </div>
        {tags.colorHex && (
          <span
            className="ml-auto h-8 w-8 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: tags.colorHex }}
          />
        )}
      </div>

      <div className="mb-4 space-y-1">
        {reasons.map((reason, i) => (
          <p key={i} className="text-sm text-neutral-700">
            \u2022 {reason}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Same category" value={String(stats.sameCategoryCount)} />
        <StatBox label="Same color" value={String(stats.sameColorCount)} />
        <StatBox label="New outfits" value={`${stats.newOutfitPotential}+`} />
        <StatBox label="Cost/wear" value={stats.projectedCostPerWear} />
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Confidence: {Math.round(tags.confidence * 100)}% \u00B7 Formality: {tags.formalityLevel}/5
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 p-2 text-center">
      <p className="text-lg font-semibold text-neutral-800">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
