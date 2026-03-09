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
        <span className="text-sm font-medium text-[#f0ece4]/80">{label}</span>
        <span className="text-xs text-[#c9a55a]">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-[#f0ece4]/35">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export function MoodSliders({ energy, boldness, onChange }: MoodSlidersProps) {
  return (
    <div className="space-y-6 rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[#f0ece4]/45">
        Як ви себе почуваєте?
      </h3>
      <SliderRow
        label="Енергія"
        value={energy}
        onChange={(v) => onChange({ energy: v, boldness })}
        leftLabel="Спокійно"
        rightLabel="Активно"
      />
      <SliderRow
        label="Сміливість"
        value={boldness}
        onChange={(v) => onChange({ energy, boldness: v })}
        leftLabel="Стримано"
        rightLabel="Яскраво"
      />
    </div>
  );
}
