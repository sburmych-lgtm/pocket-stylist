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
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-neutral-800">{name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            confidence >= 0.7
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {Math.round(confidence * 100)}% match
        </span>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0"
          >
            <div className="h-24 w-20 overflow-hidden rounded-lg bg-neutral-100">
              {item.imageUrl.startsWith("data:") ? (
                <img
                  src={item.imageUrl}
                  alt={item.category}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                  {item.category}
                </div>
              )}
            </div>
            <p className="mt-1 text-center text-xs text-neutral-500">
              {item.subcategory ?? item.category}
            </p>
          </div>
        ))}
      </div>

      <p className="mb-4 text-sm text-neutral-600">{stylingTip}</p>

      <div className="flex gap-2">
        <button
          onClick={onLike}
          className="flex-1 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium
            text-green-700 transition-colors hover:bg-green-50"
        >
          Like
        </button>
        <button
          onClick={onDislike}
          className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium
            text-red-700 transition-colors hover:bg-red-50"
        >
          Skip
        </button>
        <button
          onClick={onWear}
          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium
            text-white transition-colors hover:bg-indigo-700"
        >
          Wear Today
        </button>
      </div>
    </div>
  );
}
