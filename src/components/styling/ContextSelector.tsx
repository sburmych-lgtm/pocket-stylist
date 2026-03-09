import { Briefcase, Coffee, Dumbbell, MoonStar, Shirt } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ContextPreset {
  key: string;
  label: string;
  icon: LucideIcon;
  mood: string;
  energy: number;
  boldness: number;
  formalityMin: number;
  formalityMax: number;
}

const PRESETS: ContextPreset[] = [
  {
    key: "office",
    label: "Офіс",
    icon: Briefcase,
    mood: "Sharp tailoring",
    energy: 30,
    boldness: 20,
    formalityMin: 4,
    formalityMax: 5,
  },
  {
    key: "meeting",
    label: "Зустріч",
    icon: Coffee,
    mood: "Polished casual",
    energy: 50,
    boldness: 40,
    formalityMin: 3,
    formalityMax: 4,
  },
  {
    key: "casual",
    label: "Casual",
    icon: Shirt,
    mood: "Relaxed premium",
    energy: 50,
    boldness: 50,
    formalityMin: 1,
    formalityMax: 3,
  },
  {
    key: "active",
    label: "Активний",
    icon: Dumbbell,
    mood: "Sport luxe",
    energy: 80,
    boldness: 30,
    formalityMin: 1,
    formalityMax: 2,
  },
  {
    key: "night",
    label: "Вечір",
    icon: MoonStar,
    mood: "After-dark edit",
    energy: 65,
    boldness: 70,
    formalityMin: 3,
    formalityMax: 5,
  },
];

interface ContextSelectorProps {
  selected: string | null;
  loading: boolean;
  onSelect: (preset: {
    key: string;
    energy: number;
    boldness: number;
    formalityMin: number;
    formalityMax: number;
  }) => void;
}

export function ContextSelector({ selected, loading, onSelect }: ContextSelectorProps) {
  return (
    <div className="luxe-card space-y-6 p-6">
      <div>
        <span className="page-kicker">Context Presets</span>
        <h3 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">
          Оберіть сценарій дня
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
          Ми підлаштуємо формальність, енергію та рівень statement-драматургії під вашу ситуацію.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PRESETS.map((preset) => {
          const isSelected = selected === preset.key;

          return (
            <button
              key={preset.key}
              type="button"
              disabled={loading}
              onClick={() =>
                onSelect({
                  key: preset.key,
                  energy: preset.energy,
                  boldness: preset.boldness,
                  formalityMin: preset.formalityMin,
                  formalityMax: preset.formalityMax,
                })
              }
              className={[
                "luxe-card flex flex-col items-start gap-5 p-5 text-left disabled:opacity-60",
                isSelected
                  ? "border-[rgba(214,177,111,0.3)] bg-[linear-gradient(180deg,rgba(214,177,111,0.12),rgba(13,16,24,0.96))]"
                  : "luxe-card-hover",
              ].join(" ")}
            >
              <div className="flex w-full items-start justify-between">
                <div
                  className={[
                    "spotlight-ring flex h-12 w-12 items-center justify-center rounded-2xl",
                    isSelected
                      ? "bg-[rgba(214,177,111,0.14)] text-[var(--accent)]"
                      : "bg-white/[0.05] text-[var(--text-secondary)]",
                  ].join(" ")}
                >
                  <preset.icon size={20} strokeWidth={2.1} />
                </div>
                <span className="section-subtitle text-[0.62rem]">{preset.mood}</span>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-[var(--text-primary)]">{preset.label}</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{preset.mood}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="metric-pill">Energy {preset.energy}%</span>
                <span className="metric-pill">Boldness {preset.boldness}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
