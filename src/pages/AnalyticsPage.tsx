import { useQuery } from "@tanstack/react-query";
import { BarChart3, LoaderCircle, Sparkles } from "lucide-react";
import { SummaryCards } from "../components/analytics/SummaryCards";
import { CostPerWearTable } from "../components/analytics/CostPerWearTable";
import { DeadZoneList } from "../components/analytics/DeadZoneList";
import { GapAnalysis } from "../components/analytics/GapAnalysis";
import { EcoDashboard } from "../components/analytics/EcoDashboard";
import { GamificationPanel } from "../components/analytics/GamificationPanel";
import { analyticsApi } from "../services/api";

async function fetchDashboard() {
  return analyticsApi.getDashboard() as Promise<{
    summary: { totalItems: number; totalOutfits: number; totalWears: number; totalLogs: number; avgWearCount: number };
    costPerWear: Array<{ id: string; category: string; subcategory: string | null; colorPrimary: string; imageUrl: string; thumbnailUrl: string | null; price: number | null; timesWorn: number; costPerWear: number | null; daysSincePurchase: number }>;
    deadZone: Array<{ id: string; category: string; subcategory: string | null; colorPrimary: string; imageUrl: string; thumbnailUrl: string | null; daysSinceWorn: number; timesWorn: number }>;
    gapAnalysis: { distribution: Array<{ category: string; count: number; percentage: number }>; ideal: Array<{ category: string; percentage: number }>; gaps: Array<{ category: string; current: number; ideal: number; diff: number; status: "over" | "under" | "ok" }> };
    eco: { totalCO2Kg: number; totalWaterLiters: number; avgCO2PerItem: number; byFabric: Array<{ fabric: string; count: number; co2Kg: number; waterLiters: number }>; sustainabilityScore: number };
    gamification: { points: number; level: number; levelName: string; challenges: Array<{ id: string; name: string; description: string; target: number; progress: number; completed: boolean; icon: string }>; badges: Array<{ id: string; name: string; description: string; earned: boolean; icon: string }>; streaks: { currentDays: number; bestDays: number } };
  }>;
}

export function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <LoaderCircle size={20} className="animate-spin text-[var(--accent)]" />
          Аналізуємо ваш гардероб...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-[var(--danger)]">
          Помилка завантаження аналітики. {error instanceof Error ? error.message : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-8">
      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <span className="page-kicker">
              <BarChart3 size={14} />
              Wardrobe Intelligence
            </span>
            <h1 className="page-title">
              Аналітика, яка показує
              <br />
              реальну цінність гардеробу.
            </h1>
            <p className="page-copy">
              Від cost-per-wear до sustainability score: бачимо не просто речі, а те,
              як ваш wardrobe працює, зношується і де потребує нового фокусу.
            </p>
          </div>

          <div className="luxe-card p-6">
            <p className="section-subtitle">Key Signal</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">Avg wear count</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
                  {data.summary.avgWearCount}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
                <p className="section-subtitle">Eco score</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
                  {data.eco.sustainabilityScore}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3">
              <Sparkles size={16} className="mt-1 text-[var(--accent)]" />
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Найсильніший гардероб не завжди найбільший. Він просто краще працює у щоденному rotation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SummaryCards {...data.summary} />

      <div className="grid gap-6 xl:grid-cols-2">
        <CostPerWearTable items={data.costPerWear} />
        <DeadZoneList items={data.deadZone} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GapAnalysis gaps={data.gapAnalysis.gaps} distribution={data.gapAnalysis.distribution} />
        <EcoDashboard eco={data.eco} />
      </div>

      <GamificationPanel data={data.gamification} />
    </div>
  );
}
