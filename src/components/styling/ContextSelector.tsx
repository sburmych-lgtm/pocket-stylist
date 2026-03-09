import { Briefcase, Coffee, Dumbbell, MoonStar, Shirt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../i18n";

interface ContextPreset {
  key: string;
  labelKey: string;
  moodKey: string;
  icon: LucideIcon;
  energy: number;
  boldness: number;
  formalityMin: number;
  formalityMax: number;
}

const PRESETS: ContextPreset[] = [
  { key: "office", labelKey: "context.office", moodKey: "context.officeMood", icon: Briefcase, energy: 30, boldness: 20, formalityMin: 4, formalityMax: 5 },
  { key: "meeting", labelKey: "context.meeting", moodKey: "context.meetingMood", icon: Coffee, energy: 50, boldness: 40, formalityMin: 3, formalityMax: 4 },
  { key: "casual", labelKey: "context.casual", moodKey: "context.casualMood", icon: Shirt, energy: 50, boldness: 50, formalityMin: 1, formalityMax: 3 },
  { key: "active", labelKey: "context.active", moodKey: "context.activeMood", icon: Dumbbell, energy: 80, boldness: 30, formalityMin: 1, formalityMax: 2 },
  { key: "night", labelKey: "context.night", moodKey: "context.nightMood", icon: MoonStar, energy: 65, boldness: 70, formalityMin: 3, formalityMax: 5 },
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
  const { t } = useI18n();

  return (
    <div className="luxe-card space-y-6 p-6">
      <div>
        <span className="page-kicker">{t("context.kicker")}</span>
        <h3 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">
          {t("context.title")}
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
          {t("context.desc")}
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
                  ? "border-[rgba(201,165,90,0.3)] bg-[linear-gradient(180deg,rgba(201,165,90,0.12),rgba(13,16,24,0.96))]"
                  : "luxe-card-hover",
              ].join(" ")}
            >
              <div className="flex w-full items-start justify-between">
                <div
                  className={[
                    "spotlight-ring flex h-12 w-12 items-center justify-center rounded-2xl",
                    isSelected
                      ? "bg-[rgba(201,165,90,0.14)] text-[var(--accent)]"
                      : "bg-white/[0.05] text-[var(--text-secondary)]",
                  ].join(" ")}
                >
                  <preset.icon size={20} strokeWidth={2.1} />
                </div>
                <span className="section-subtitle text-[0.62rem]">{t(preset.moodKey)}</span>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-[var(--text-primary)]">{t(preset.labelKey)}</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t(preset.moodKey)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="metric-pill">{t("context.energyLabel", { value: preset.energy })}</span>
                <span className="metric-pill">{t("context.boldnessLabel", { value: preset.boldness })}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
