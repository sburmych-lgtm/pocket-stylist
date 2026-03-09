import type { WardrobeItem } from "../../types/wardrobe";

interface OutfitCardProps {
  name: string;
  items: WardrobeItem[];
  stylingTip: string;
  confidence: number;
  onLike?: () => void;
  onDislike?: () => void;
  onWear?: () => void;
}

export function OutfitCard({
  name,
  items,
  stylingTip,
  confidence,
  onLike,
  onDislike,
  onWear,
}: OutfitCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-[#f0ece4]">{name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            confidence >= 0.7
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {Math.round(confidence * 100)}% match
        </span>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
        {items.map((item) => (
          <div key={item.id} className="flex-shrink-0">
            <div className="h-24 w-20 overflow-hidden rounded-lg bg-white/[0.03]">
              {item.imageUrl.startsWith("data:") ? (
                <img src={item.imageUrl} alt={item.category} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[#f0ece4]/25">
                  {item.category}
                </div>
              )}
            </div>
            <p className="mt-1 text-center text-xs text-[#f0ece4]/45">
              {item.subcategory ?? item.category}
            </p>
          </div>
        ))}
      </div>

      <p className="mb-4 text-sm text-[#f0ece4]/55">{stylingTip}</p>

      <div className="flex gap-2">
        <button onClick={onLike}
          className="flex-1 rounded-lg border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10">
          Подобається
        </button>
        <button onClick={onDislike}
          className="flex-1 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10">
          Пропустити
        </button>
        <button onClick={onWear}
          className="gold-btn flex-1 px-3 py-2 text-sm">
          Вдягну
        </button>
      </div>
    </div>
  );
}
