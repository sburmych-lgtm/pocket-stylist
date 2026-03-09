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
      <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-6 text-center text-sm text-[#f0ece4]/45">
        Додайте ціни до речей, щоб побачити аналіз вартості носіння
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e]">
      <div className="border-b border-white/[0.06] px-5 py-3">
        <h3 className="font-semibold text-[#f0ece4]">Вартість носіння</h3>
        <p className="text-xs text-[#f0ece4]/35">Найдорожчі за носіння першими</p>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {items.slice(0, 10).map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
              {(item.thumbnailUrl ?? item.imageUrl).startsWith("data:") ? (
                <img
                  src={item.thumbnailUrl ?? item.imageUrl}
                  alt={item.category}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[#f0ece4]/35">
                  {item.category.slice(0, 3)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#f0ece4]/80">
                {item.subcategory ?? item.category}
              </p>
              <p className="text-xs text-[#f0ece4]/35">
                {item.colorPrimary} · {item.timesWorn} носінь
              </p>
            </div>
            <div className="text-right">
              {item.costPerWear != null ? (
                <>
                  <p className={`text-sm font-semibold ${item.costPerWear > 20 ? "text-red-400" : item.costPerWear > 5 ? "text-amber-400" : "text-emerald-400"}`}>
                    ${item.costPerWear.toFixed(2)}
                  </p>
                  <p className="text-xs text-[#f0ece4]/35">/носіння</p>
                </>
              ) : (
                <p className="text-xs text-[#f0ece4]/35">Без ціни</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
