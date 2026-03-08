interface ContextPreset {
  key: string;
  emoji: string;
  label: string;
  energy: number;
  boldness: number;
  formalityMin: number;
  formalityMax: number;
}

const PRESETS: ContextPreset[] = [
  { key: "office", emoji: "\uD83C\uDFE2", label: "Офіс", energy: 30, boldness: 20, formalityMin: 4, formalityMax: 5 },
  { key: "meeting", emoji: "\u2615", label: "Зустріч", energy: 50, boldness: 40, formalityMin: 3, formalityMax: 4 },
  { key: "casual", emoji: "\uD83D\uDC55", label: "Casual", energy: 50, boldness: 50, formalityMin: 1, formalityMax: 3 },
  { key: "active", emoji: "\uD83C\uDFC3", label: "Активний", energy: 80, boldness: 30, formalityMin: 1, formalityMax: 2 },
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
        Оберіть контекст
      </h3>
      <div className="grid grid-cols-2 gap-3">
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
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-center
                transition-all disabled:opacity-50 ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
            >
              <span className="text-3xl">{preset.emoji}</span>
              <span className={`text-sm font-semibold ${isSelected ? "text-indigo-700" : "text-neutral-700"}`}>
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
