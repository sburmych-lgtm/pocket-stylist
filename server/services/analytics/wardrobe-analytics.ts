const DEAD_ZONE_DAYS = 90;

export interface CostPerWearItem {
  id: string;
  category: string;
  subcategory: string | null;
  colorPrimary: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  price: number | null;
  timesWorn: number;
  costPerWear: number | null;
  daysSincePurchase: number;
}

export interface DeadZoneItem {
  id: string;
  category: string;
  subcategory: string | null;
  colorPrimary: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  daysSinceWorn: number;
  timesWorn: number;
}

export interface GapAnalysisResult {
  distribution: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  ideal: Array<{
    category: string;
    percentage: number;
  }>;
  gaps: Array<{
    category: string;
    current: number;
    ideal: number;
    diff: number;
    status: "over" | "under" | "ok";
  }>;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  icon: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  icon: string;
}

export interface GamificationData {
  points: number;
  level: number;
  levelName: string;
  challenges: Challenge[];
  badges: Badge[];
  streaks: { currentDays: number; bestDays: number };
}

// Ideal wardrobe distribution (approximate)
const IDEAL_DISTRIBUTION: Record<string, number> = {
  tops: 30,
  bottoms: 20,
  dresses: 10,
  outerwear: 10,
  shoes: 15,
  accessories: 15,
};

export function computeCostPerWear(
  items: Array<{
    id: string;
    category: string;
    subcategory: string | null;
    colorPrimary: string;
    imageUrl: string;
    thumbnailUrl: string | null;
    price: number | null;
    timesWorn: number;
    purchasedAt: Date | null;
    createdAt: Date;
  }>,
): CostPerWearItem[] {
  const now = Date.now();

  return items
    .map((item) => {
      const purchaseDate = item.purchasedAt ?? item.createdAt;
      const daysSincePurchase = Math.max(
        1,
        Math.floor((now - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const costPerWear =
        item.price != null && item.timesWorn > 0
          ? Math.round((item.price / item.timesWorn) * 100) / 100
          : null;

      return {
        id: item.id,
        category: item.category,
        subcategory: item.subcategory,
        colorPrimary: item.colorPrimary,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        price: item.price,
        timesWorn: item.timesWorn,
        costPerWear,
        daysSincePurchase,
      };
    })
    .sort((a, b) => {
      if (a.costPerWear == null && b.costPerWear == null) return 0;
      if (a.costPerWear == null) return 1;
      if (b.costPerWear == null) return -1;
      return b.costPerWear - a.costPerWear; // highest cost-per-wear first
    });
}

export function findDeadZoneItems(
  items: Array<{
    id: string;
    category: string;
    subcategory: string | null;
    colorPrimary: string;
    imageUrl: string;
    thumbnailUrl: string | null;
    timesWorn: number;
    lastWornAt: Date | null;
    createdAt: Date;
  }>,
): DeadZoneItem[] {
  const now = Date.now();

  return items
    .filter((item) => {
      const lastDate = item.lastWornAt ?? item.createdAt;
      const days = Math.floor(
        (now - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return days >= DEAD_ZONE_DAYS;
    })
    .map((item) => {
      const lastDate = item.lastWornAt ?? item.createdAt;
      const daysSinceWorn = Math.floor(
        (now - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: item.id,
        category: item.category,
        subcategory: item.subcategory,
        colorPrimary: item.colorPrimary,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        daysSinceWorn,
        timesWorn: item.timesWorn,
      };
    })
    .sort((a, b) => b.daysSinceWorn - a.daysSinceWorn);
}

export function computeGapAnalysis(
  items: Array<{ category: string }>,
): GapAnalysisResult {
  const categoryCounts = new Map<string, number>();

  for (const item of items) {
    const cat = item.category.toLowerCase();
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  const total = items.length || 1;

  const distribution = [...categoryCounts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const ideal = Object.entries(IDEAL_DISTRIBUTION).map(
    ([category, percentage]) => ({ category, percentage }),
  );

  const gaps = ideal.map(({ category, percentage: idealPct }) => {
    const currentPct =
      distribution.find((d) => d.category === category)?.percentage ?? 0;
    const diff = currentPct - idealPct;
    const status: "over" | "under" | "ok" =
      diff > 5 ? "over" : diff < -5 ? "under" : "ok";
    return { category, current: currentPct, ideal: idealPct, diff, status };
  });

  return { distribution, ideal, gaps };
}

export function computeGamification(
  wardrobeCount: number,
  totalWears: number,
  outfitCount: number,
  deadZoneCount: number,
  daysSinceFirstItem: number,
): GamificationData {
  // Points
  const importPoints = wardrobeCount * 10;
  const wearPoints = totalWears * 5;
  const outfitPoints = outfitCount * 15;
  const points = importPoints + wearPoints + outfitPoints;

  // Level
  const level = Math.floor(points / 100) + 1;
  const levelNames = [
    "Closet Rookie",
    "Style Apprentice",
    "Fashion Scout",
    "Wardrobe Strategist",
    "Style Maven",
    "Fashion Alchemist",
    "Couture Commander",
    "Style Titan",
  ];
  const levelName = levelNames[Math.min(level - 1, levelNames.length - 1)];

  // Challenges
  const challenges: Challenge[] = [
    {
      id: "capsule-15",
      name: "Capsule 15",
      description: "Create 15 outfits from just 15 items",
      target: 15,
      progress: Math.min(outfitCount, 15),
      completed: outfitCount >= 15,
      icon: "capsule",
    },
    {
      id: "wear-all",
      name: "No Neglect",
      description: "Wear every item at least once",
      target: wardrobeCount,
      progress: wardrobeCount - deadZoneCount,
      completed: deadZoneCount === 0 && wardrobeCount > 0,
      icon: "check-all",
    },
    {
      id: "log-30",
      name: "30-Day Streak",
      description: "Log outfits for 30 consecutive days",
      target: 30,
      progress: Math.min(totalWears, 30),
      completed: totalWears >= 30,
      icon: "calendar",
    },
    {
      id: "import-50",
      name: "Full Closet",
      description: "Import 50 items to your wardrobe",
      target: 50,
      progress: Math.min(wardrobeCount, 50),
      completed: wardrobeCount >= 50,
      icon: "wardrobe",
    },
  ];

  // Badges
  const badges: Badge[] = [
    {
      id: "first-import",
      name: "First Step",
      description: "Import your first item",
      earned: wardrobeCount >= 1,
      icon: "star",
    },
    {
      id: "fashionista",
      name: "Fashionista",
      description: "Import 100+ items",
      earned: wardrobeCount >= 100,
      icon: "crown",
    },
    {
      id: "eco-warrior",
      name: "Eco Warrior",
      description: "Zero dead zone items",
      earned: deadZoneCount === 0 && wardrobeCount >= 10,
      icon: "leaf",
    },
    {
      id: "veteran",
      name: "Style Veteran",
      description: "Use Pocket Stylist for 30+ days",
      earned: daysSinceFirstItem >= 30,
      icon: "medal",
    },
    {
      id: "outfit-master",
      name: "Outfit Master",
      description: "Create 25+ saved outfits",
      earned: outfitCount >= 25,
      icon: "trophy",
    },
  ];

  return {
    points,
    level,
    levelName,
    challenges,
    badges,
    streaks: { currentDays: Math.min(totalWears, 7), bestDays: Math.min(totalWears, 7) },
  };
}
