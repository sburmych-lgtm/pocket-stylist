interface SummaryCardsProps {
  totalItems: number;
  totalOutfits: number;
  totalWears: number;
  avgWearCount: number;
}

const CARDS = [
  { key: "totalItems", label: "Wardrobe Items", color: "text-indigo-600" },
  { key: "totalOutfits", label: "Saved Outfits", color: "text-emerald-600" },
  { key: "totalWears", label: "Total Wears", color: "text-amber-600" },
  { key: "avgWearCount", label: "Avg Wears/Item", color: "text-rose-600" },
] as const;

export function SummaryCards(props: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border border-neutral-200 bg-white p-4 text-center"
        >
          <p className={`text-2xl font-bold ${card.color}`}>
            {props[card.key]}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
