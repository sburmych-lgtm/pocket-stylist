/**
 * CO2 footprint estimates by fabric type (kg CO2 per garment).
 * Source: approximate industry averages.
 */
const CO2_PER_GARMENT: Record<string, number> = {
  polyester: 5.5,
  nylon: 5.4,
  acrylic: 5.0,
  viscose: 4.0,
  rayon: 4.0,
  wool: 10.0,
  cashmere: 12.0,
  silk: 6.0,
  cotton: 8.0,
  "organic cotton": 3.5,
  linen: 1.5,
  hemp: 1.2,
  denim: 9.0,
  leather: 17.0,
  "faux leather": 7.0,
  fleece: 5.5,
  jersey: 4.5,
  chiffon: 3.5,
  tweed: 8.0,
  velvet: 6.0,
  satin: 4.0,
  lace: 4.5,
  corduroy: 7.0,
  suede: 15.0,
};

const WATER_PER_GARMENT: Record<string, number> = {
  cotton: 2700,
  "organic cotton": 1800,
  polyester: 600,
  nylon: 700,
  wool: 500,
  linen: 300,
  hemp: 200,
  denim: 3800,
  leather: 4500,
  silk: 1500,
  cashmere: 3000,
};

export interface EcoMetrics {
  totalCO2Kg: number;
  totalWaterLiters: number;
  avgCO2PerItem: number;
  byFabric: Array<{
    fabric: string;
    count: number;
    co2Kg: number;
    waterLiters: number;
  }>;
  sustainabilityScore: number; // 0-100
}

export function calculateEcoMetrics(
  items: Array<{ fabric: string | null }>,
): EcoMetrics {
  const fabricCounts = new Map<string, number>();

  for (const item of items) {
    const fabric = (item.fabric ?? "unknown").toLowerCase();
    fabricCounts.set(fabric, (fabricCounts.get(fabric) ?? 0) + 1);
  }

  const byFabric: EcoMetrics["byFabric"] = [];
  let totalCO2 = 0;
  let totalWater = 0;

  for (const [fabric, count] of fabricCounts) {
    const co2 = (CO2_PER_GARMENT[fabric] ?? 5.0) * count;
    const water = (WATER_PER_GARMENT[fabric] ?? 800) * count;
    totalCO2 += co2;
    totalWater += water;
    byFabric.push({ fabric, count, co2Kg: Math.round(co2 * 10) / 10, waterLiters: Math.round(water) });
  }

  byFabric.sort((a, b) => b.co2Kg - a.co2Kg);

  // Sustainability score: lower CO2 per item = higher score
  const avgCO2 = items.length > 0 ? totalCO2 / items.length : 0;
  // Baseline: 8 kg avg → 50 score, 2 kg → 100, 15 kg → 0
  const sustainabilityScore = Math.round(
    Math.max(0, Math.min(100, 100 - ((avgCO2 - 2) / 13) * 100)),
  );

  return {
    totalCO2Kg: Math.round(totalCO2 * 10) / 10,
    totalWaterLiters: Math.round(totalWater),
    avgCO2PerItem: Math.round(avgCO2 * 10) / 10,
    byFabric,
    sustainabilityScore,
  };
}
