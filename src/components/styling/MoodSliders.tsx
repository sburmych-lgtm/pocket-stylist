interface MoodSlidersProps {
  energy: number;
  boldness: number;
  onChange: (mood: { energy: number; boldness: number }) => void;
}

function SliderRow({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">{label}</span>
        <span className="text-xs text-neutral-500">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-neutral-400">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export function MoodSliders({ energy, boldness, onChange }: MoodSlidersProps) {
  return (
    <div className="space-y-6 rounded-xl border border-neutral-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
        How are you feeling?
      </h3>
      <SliderRow
        label="Energy"
        value={energy}
        onChange={(v) => onChange({ energy: v, boldness })}
        leftLabel="Chill"
        rightLabel="Active"
      />
      <SliderRow
        label="Boldness"
        value={boldness}
        onChange={(v) => onChange({ energy, boldness: v })}
        leftLabel="Subtle"
        rightLabel="Bold"
      />
    </div>
  );
}
