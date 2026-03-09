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
  if (score >= 70) {
    return "text-[var(--success)]";
  }
  if (score >= 40) {
    return "text-[var(--warning)]";
  }
  return "text-[var(--danger)]";
}

function scoreLabel(score: number): string {
  if (score >= 70) {
    return "Eco-friendly";
  }
  if (score >= 40) {
    return "Moderate footprint";
  }
  return "High impact";
}

export function EcoDashboard({ eco }: EcoDashboardProps) {
  const maxCo2 = Math.max(...eco.byFabric.map((item) => item.co2Kg), 1);

  return (
    <section className="luxe-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-subtitle">Sustainability Lens</p>
          <h3 className="section-title mt-2">Еко-вплив гардеробу</h3>
        </div>
        <span className={`text-sm font-semibold ${scoreColor(eco.sustainabilityScore)}`}>
          {scoreLabel(eco.sustainabilityScore)}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-5 text-center">
          <p className="section-subtitle">Score</p>
          <p className={`mt-3 text-4xl font-semibold ${scoreColor(eco.sustainabilityScore)}`}>
            {eco.sustainabilityScore}
          </p>
        </div>
        <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-5 text-center">
          <p className="section-subtitle">CO2</p>
          <p className="mt-3 text-4xl font-semibold text-[var(--text-primary)]">{eco.totalCO2Kg}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">кг</p>
        </div>
        <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-5 text-center">
          <p className="section-subtitle">Water</p>
          <p className="mt-3 text-4xl font-semibold text-[var(--text-primary)]">
            {eco.totalWaterLiters > 1000
              ? `${(eco.totalWaterLiters / 1000).toFixed(1)}k`
              : eco.totalWaterLiters}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">літрів</p>
        </div>
      </div>

      <div className="editorial-divider my-6" />

      <div className="space-y-4">
        {eco.byFabric.slice(0, 6).map((fabric) => (
          <div key={fabric.fabric} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold capitalize text-[var(--text-primary)]">{fabric.fabric}</span>
              <span className="text-[var(--text-secondary)]">
                {fabric.co2Kg} кг · {fabric.count} items
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[rgba(136,198,189,0.62)] to-[var(--accent-cool)]"
                style={{ width: `${Math.max((fabric.co2Kg / maxCo2) * 100, 8)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
