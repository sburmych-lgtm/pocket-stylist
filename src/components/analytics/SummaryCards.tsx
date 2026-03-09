import { Layers, Repeat, Shirt, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SummaryCardsProps {
  totalItems: number;
  totalOutfits: number;
  totalWears: number;
  avgWearCount: number;
}

const CARDS: Array<{
  key: keyof SummaryCardsProps;
  label: string;
  note: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    key: "totalItems",
    label: "Curated pieces",
    note: "Поточний розмір гардеробу",
    icon: Shirt,
    tone: "bg-[rgba(214,177,111,0.12)] text-[var(--accent)]",
  },
  {
    key: "totalOutfits",
    label: "Look outputs",
    note: "Згенеровані комбінації",
    icon: Sparkles,
    tone: "bg-[rgba(136,198,189,0.12)] text-[var(--accent-cool)]",
  },
  {
    key: "totalWears",
    label: "Wear logs",
    note: "Скільки разів речі реально носили",
    icon: Repeat,
    tone: "bg-[rgba(111,212,171,0.12)] text-[var(--success)]",
  },
  {
    key: "avgWearCount",
    label: "Avg wear count",
    note: "Середня активність речей",
    icon: Layers,
    tone: "bg-[rgba(241,195,121,0.12)] text-[var(--warning)]",
  },
];

export function SummaryCards(props: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => (
        <article key={card.key} className="luxe-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-subtitle">{card.label}</p>
              <p className="mt-3 text-4xl font-semibold leading-none text-[var(--text-primary)]">
                {props[card.key]}
              </p>
            </div>
            <div className={`spotlight-ring flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={20} />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{card.note}</p>
        </article>
      ))}
    </div>
  );
}
