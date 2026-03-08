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
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
        Add prices to your items to see cost-per-wear analysis
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-3">
        <h3 className="font-semibold text-neutral-800">Cost Per Wear</h3>
        <p className="text-xs text-neutral-400">Highest cost-per-wear items first</p>
      </div>
      <div className="divide-y divide-neutral-100">
        {items.slice(0, 10).map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              {(item.thumbnailUrl ?? item.imageUrl).startsWith("data:") ? (
                <img
                  src={item.thumbnailUrl ?? item.imageUrl}
                  alt={item.category}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                  {item.category.slice(0, 3)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-700">
                {item.subcategory ?? item.category}
              </p>
              <p className="text-xs text-neutral-400">
                {item.colorPrimary} · {item.timesWorn} wears
              </p>
            </div>
            <div className="text-right">
              {item.costPerWear != null ? (
                <>
                  <p className={`text-sm font-semibold ${item.costPerWear > 20 ? "text-red-600" : item.costPerWear > 5 ? "text-amber-600" : "text-green-600"}`}>
                    ${item.costPerWear.toFixed(2)}
                  </p>
                  <p className="text-xs text-neutral-400">/wear</p>
                </>
              ) : (
                <p className="text-xs text-neutral-400">No price</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
