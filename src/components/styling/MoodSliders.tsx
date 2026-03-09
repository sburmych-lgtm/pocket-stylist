import { Flame, Gem, Sparkles } from "lucide-react";

interface MoodSlidersProps {
  energy: number;
  boldness: number;
  onChange: (mood: { energy: number; boldness: number }) => void;
}

function energyLabel(value: number) {
  if (value < 35) {
    return "Quiet luxury";
  }
  if (value < 70) {
    return "Balanced momentum";
  }
  return "High-energy statement";
}

function boldnessLabel(value: number) {
  if (value < 35) {
    return "Soft minimalism";
  }
  if (value < 70) {
    return "Curated confidence";
  }
  return "Runway-ready impact";
}

function SliderRow({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
  accentClass,
  Icon,
  descriptor,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  accentClass: string;
  Icon: typeof Flame;
  descriptor: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`spotlight-ring flex h-11 w-11 items-center justify-center rounded-2xl ${accentClass}`}>
            <Icon size={19} />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">{label}</p>
            <p className="text-sm text-[var(--text-secondary)]">{descriptor}</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-[var(--accent)]">{value}%</span>
      </div>

      <div className="mt-5">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-3 flex justify-between text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function MoodSliders({ energy, boldness, onChange }: MoodSlidersProps) {
  return (
    <div className="luxe-card space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="page-kicker">
            <Sparkles size={14} />
            Mood Engine
          </span>
          <h3 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">
            Налаштуйте настрій образу
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            Працюємо як персональний стиліст: від тихої впевненості до statement-образу.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SliderRow
          label="Енергія"
          value={energy}
          onChange={(value) => onChange({ energy: value, boldness })}
          leftLabel="Спокійно"
          rightLabel="Динамічно"
          accentClass="bg-[rgba(214,177,111,0.12)] text-[var(--accent)]"
          Icon={Flame}
          descriptor={energyLabel(energy)}
        />
        <SliderRow
          label="Сміливість"
          value={boldness}
          onChange={(value) => onChange({ energy, boldness: value })}
          leftLabel="Стримано"
          rightLabel="Яскраво"
          accentClass="bg-[rgba(136,198,189,0.12)] text-[var(--accent-cool)]"
          Icon={Gem}
          descriptor={boldnessLabel(boldness)}
        />
      </div>
    </div>
  );
}
