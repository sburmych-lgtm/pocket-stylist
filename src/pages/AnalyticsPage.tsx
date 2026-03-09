import { useQuery } from "@tanstack/react-query";
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
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#c9a55a] border-t-transparent" />
          <span className="text-[#f0ece4]/45">Аналізую ваш гардероб...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-red-400">
          Помилка завантаження аналітики. {error instanceof Error ? error.message : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[#c9a55a]">
          Аналітика
        </h1>
        <p className="text-sm text-[#f0ece4]/45">
          Дашборд інтелекту вашого гардеробу
        </p>
      </div>

      <SummaryCards {...data.summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CostPerWearTable items={data.costPerWear} />
        <DeadZoneList items={data.deadZone} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GapAnalysis gaps={data.gapAnalysis.gaps} distribution={data.gapAnalysis.distribution} />
        <EcoDashboard eco={data.eco} />
      </div>

      <GamificationPanel data={data.gamification} />
    </div>
  );
}
