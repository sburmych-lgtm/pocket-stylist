interface SummaryCardsProps {
  totalItems: number;
  totalOutfits: number;
  totalWears: number;
  avgWearCount: number;
}

const CARDS = [
  { key: "totalItems", label: "Речей", color: "text-[#c9a55a]" },
  { key: "totalOutfits", label: "Образів", color: "text-emerald-400" },
  { key: "totalWears", label: "Носінь", color: "text-amber-400" },
  { key: "avgWearCount", label: "Серед. носінь", color: "text-rose-400" },
] as const;

export function SummaryCards(props: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map((card) => (
        <div key={card.key}
          className="rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-4 text-center">
          <p className={`text-2xl font-bold ${card.color}`}>
            {props[card.key]}
          </p>
          <p className="mt-1 text-xs text-[#f0ece4]/45">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
