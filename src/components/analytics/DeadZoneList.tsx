interface DeadZoneItem {
  id: string;
  category: string;
  subcategory: string | null;
  colorPrimary: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  daysSinceWorn: number;
  timesWorn: number;
}

interface DeadZoneListProps {
  items: DeadZoneItem[];
}

export function DeadZoneList({ items }: DeadZoneListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center text-sm text-green-700">
        No dead zone items — you're wearing everything!
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-3">
        <h3 className="font-semibold text-neutral-800">Dead Zone</h3>
        <p className="text-xs text-neutral-400">
          Items not worn in 90+ days — consider selling or donating
        </p>
      </div>
      <div className="divide-y divide-neutral-100">
        {items.map((item) => (
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
              <p className="text-xs text-neutral-400">{item.colorPrimary}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-red-600">
                {item.daysSinceWorn}d
              </p>
              <p className="text-xs text-neutral-400">
                {item.timesWorn === 0 ? "never worn" : `${item.timesWorn} wears`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
