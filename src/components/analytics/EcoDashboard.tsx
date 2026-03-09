interface EcoMetrics {
  totalCO2Kg: number;
  totalWaterLiters: number;
  avgCO2PerItem: number;
  byFabric: Array<{ fabric: string; count: number; co2Kg: number; waterLiters: number }>;
  sustainabilityScore: number;
}

interface EcoDashboardProps {
  eco: EcoMetrics;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Eco-Friendly";
  if (score >= 40) return "Середній";
  return "Високий вплив";
}

export function EcoDashboard({ eco }: EcoDashboardProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e]">
      <div className="border-b border-white/[0.06] px-5 py-3">
        <h3 className="font-semibold text-[#f0ece4]">Еко-вплив</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 px-5 py-4">
        <div className="text-center">
          <p className={`text-2xl font-bold ${scoreColor(eco.sustainabilityScore)}`}>
            {eco.sustainabilityScore}
          </p>
          <p className={`text-xs font-medium ${scoreColor(eco.sustainabilityScore)}`}>
            {scoreLabel(eco.sustainabilityScore)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#f0ece4]/80">{eco.totalCO2Kg}</p>
          <p className="text-xs text-[#f0ece4]/35">кг CO2</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[#f0ece4]/80">
            {eco.totalWaterLiters > 1000 ? `${(eco.totalWaterLiters / 1000).toFixed(1)}k` : eco.totalWaterLiters}
          </p>
          <p className="text-xs text-[#f0ece4]/35">л води</p>
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-5 py-3">
        <p className="mb-2 text-xs font-medium uppercase text-[#f0ece4]/35">
          CO2 по тканинах
        </p>
        <div className="space-y-1.5">
          {eco.byFabric.slice(0, 6).map((f) => (
            <div key={f.fabric} className="flex items-center gap-2">
              <span className="w-20 truncate text-right text-xs capitalize text-[#f0ece4]/45">
                {f.fabric}
              </span>
              <div className="flex-1">
                <div className="h-3 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(f.co2Kg / Math.max(eco.byFabric[0].co2Kg, 1)) * 100}%`, minWidth: "4px" }} />
              </div>
              <span className="w-14 text-right text-xs text-[#f0ece4]/45">
                {f.co2Kg} кг
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
