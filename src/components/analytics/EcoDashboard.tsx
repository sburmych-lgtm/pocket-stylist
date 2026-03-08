interface EcoMetrics {
  totalCO2Kg: number;
  totalWaterLiters: number;
  avgCO2PerItem: number;
  byFabric: Array<{
    fabric: string;
    count: number;
    co2Kg: number;
    waterLiters: number;
  }>;
  sustainabilityScore: number;
}

interface EcoDashboardProps {
  eco: EcoMetrics;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Eco-Friendly";
  if (score >= 40) return "Average";
  return "High Impact";
}

export function EcoDashboard({ eco }: EcoDashboardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-3">
        <h3 className="font-semibold text-neutral-800">Eco Impact</h3>
      </div>

      {/* Score + totals */}
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
          <p className="text-2xl font-bold text-neutral-700">
            {eco.totalCO2Kg}
          </p>
          <p className="text-xs text-neutral-400">kg CO2</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-neutral-700">
            {eco.totalWaterLiters > 1000
              ? `${(eco.totalWaterLiters / 1000).toFixed(1)}k`
              : eco.totalWaterLiters}
          </p>
          <p className="text-xs text-neutral-400">L water</p>
        </div>
      </div>

      {/* Fabric breakdown */}
      <div className="border-t border-neutral-100 px-5 py-3">
        <p className="mb-2 text-xs font-medium text-neutral-500 uppercase">
          CO2 by Fabric
        </p>
        <div className="space-y-1.5">
          {eco.byFabric.slice(0, 6).map((f) => (
            <div key={f.fabric} className="flex items-center gap-2">
              <span className="w-20 truncate text-right text-xs text-neutral-500 capitalize">
                {f.fabric}
              </span>
              <div className="flex-1">
                <div
                  className="h-3 rounded-full bg-emerald-400 transition-all"
                  style={{
                    width: `${(f.co2Kg / Math.max(eco.byFabric[0].co2Kg, 1)) * 100}%`,
                    minWidth: "4px",
                  }}
                />
              </div>
              <span className="w-14 text-right text-xs text-neutral-500">
                {f.co2Kg} kg
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
