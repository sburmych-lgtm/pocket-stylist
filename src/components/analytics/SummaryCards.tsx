import { Layers, Repeat, Shirt, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../i18n";

interface SummaryCardsProps {
  totalItems: number;
  totalOutfits: number;
  totalWears: number;
  avgWearCount: number;
}

const CARDS: Array<{
  key: keyof SummaryCardsProps;
  labelKey: string;
  noteKey: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    key: "totalItems",
    labelKey: "analytics.curatedPieces",
    noteKey: "analytics.curatedPiecesNote",
    icon: Shirt,
    tone: "bg-[rgba(201,165,90,0.12)] text-[var(--accent)]",
  },
  {
    key: "totalOutfits",
    labelKey: "analytics.lookOutputs",
    noteKey: "analytics.lookOutputsNote",
    icon: Sparkles,
    tone: "bg-[rgba(136,198,189,0.12)] text-[var(--accent-cool)]",
  },
  {
    key: "totalWears",
    labelKey: "analytics.wearLogs",
    noteKey: "analytics.wearLogsNote",
    icon: Repeat,
    tone: "bg-[rgba(111,212,171,0.12)] text-[var(--success)]",
  },
  {
    key: "avgWearCount",
    labelKey: "analytics.avgWearCount",
    noteKey: "analytics.avgWearCountNote",
    icon: Layers,
    tone: "bg-[rgba(241,195,121,0.12)] text-[var(--warning)]",
  },
];

export function SummaryCards(props: SummaryCardsProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => (
        <article key={card.key} className="luxe-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-subtitle">{t(card.labelKey)}</p>
              <p className="mt-3 text-4xl font-semibold leading-none text-[var(--text-primary)]">
                {props[card.key]}
              </p>
            </div>
            <div className={`spotlight-ring flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon size={20} />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{t(card.noteKey)}</p>
        </article>
      ))}
    </div>
  );
}
