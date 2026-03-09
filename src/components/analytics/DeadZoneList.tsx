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
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center text-sm text-emerald-400">
        Немає забутих речей — ви носите все!
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e]">
      <div className="border-b border-white/[0.06] px-5 py-3">
        <h3 className="font-semibold text-[#f0ece4]">Мертва зона</h3>
        <p className="text-xs text-[#f0ece4]/35">
          Речі без носіння 90+ днів — подумайте про продаж або донат
        </p>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {items.map((item) => (
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
              <p className="text-xs text-[#f0ece4]/35">{item.colorPrimary}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-red-400">
                {item.daysSinceWorn}д
              </p>
              <p className="text-xs text-[#f0ece4]/35">
                {item.timesWorn === 0 ? "не вдягано" : `${item.timesWorn} носінь`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
