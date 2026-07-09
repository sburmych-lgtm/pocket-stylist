import type { WardrobeItem } from "../../src/generated/prisma/client.js";
import type { StylistPersona } from "../../server/services/styling/personas.js";

export interface StylistScenarioContext {
  mood: { energy: number; boldness: number };
  weatherSeason: "spring" | "summer" | "fall" | "winter";
  temp: number;
  condition: string;
  precipMm: number;
  formalityRange: { min: number; max: number };
  persona: StylistPersona;
  colorSeason?: string | null;
  colorPalette?: Array<{ name: string; hex: string }>;
  avoidColors?: Array<{ name: string; hex: string }>;
  genderMode?: string;
}

export interface StylistEvaluationScenario {
  id: string;
  title: string;
  context: StylistScenarioContext;
  wardrobe: WardrobeItem[];
  expected: {
    minCandidates?: number;
    minRulesOnlyOutfits?: number;
    mustUseCategory?: string;
    mustAvoidCategory?: string;
    mustAvoidItemId?: string;
    note: string;
  };
}

const NOW = new Date("2026-01-15T10:00:00.000Z");

export function wardrobeItem(
  id: string,
  overrides: Partial<WardrobeItem> = {},
): WardrobeItem {
  return {
    id,
    userId: "scenario-user",
    imageUrl: `https://example.test/${id}.jpg`,
    thumbnailUrl: null,
    category: "tops",
    subcategory: "shirt",
    colorPrimary: "navy",
    colorHex: "#000080",
    pattern: "solid",
    fabric: "cotton",
    formalityLevel: 3,
    season: "all",
    brand: null,
    price: null,
    condition: "good",
    confidence: 0.9,
    timesWorn: 0,
    lastWornAt: null,
    purchasedAt: null,
    sharedWithFamily: false,
    tags: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const baseWardrobe = [
  wardrobeItem("white-shirt", {
    category: "tops",
    subcategory: "crisp white shirt",
    colorPrimary: "white",
    colorHex: "#F7F4EC",
    fabric: "cotton",
    formalityLevel: 4,
  }),
  wardrobeItem("navy-knit", {
    category: "tops",
    subcategory: "navy fine-knit top",
    colorPrimary: "navy",
    colorHex: "#1C2F4A",
    fabric: "knit",
    formalityLevel: 3,
    season: "fall",
  }),
  wardrobeItem("linen-shirt", {
    category: "tops",
    subcategory: "linen relaxed shirt",
    colorPrimary: "cream",
    colorHex: "#F4EAD8",
    fabric: "linen",
    formalityLevel: 2,
    season: "summer",
  }),
  wardrobeItem("black-trousers", {
    category: "pants",
    subcategory: "tailored black trousers",
    colorPrimary: "black",
    colorHex: "#111111",
    fabric: "polyester",
    formalityLevel: 4,
  }),
  wardrobeItem("blue-jeans", {
    category: "jeans",
    subcategory: "straight blue jeans",
    colorPrimary: "blue",
    colorHex: "#355C91",
    fabric: "denim",
    formalityLevel: 2,
  }),
  wardrobeItem("black-dress", {
    category: "dresses",
    subcategory: "black midi dress",
    colorPrimary: "black",
    colorHex: "#0B0B0C",
    fabric: "silk",
    formalityLevel: 4,
    season: "all",
  }),
  wardrobeItem("wool-coat", {
    category: "outerwear",
    subcategory: "wool coat",
    colorPrimary: "black",
    colorHex: "#101010",
    fabric: "wool",
    formalityLevel: 4,
    season: "winter",
  }),
  wardrobeItem("trench", {
    category: "outerwear",
    subcategory: "beige trench coat",
    colorPrimary: "beige",
    colorHex: "#CBB99B",
    fabric: "cotton",
    formalityLevel: 4,
    season: "fall",
  }),
  wardrobeItem("white-sneakers", {
    category: "footwear",
    subcategory: "white leather sneakers",
    colorPrimary: "white",
    colorHex: "#F0EFEA",
    fabric: "leather",
    formalityLevel: 2,
  }),
  wardrobeItem("black-loafers", {
    category: "footwear",
    subcategory: "black leather loafers",
    colorPrimary: "black",
    colorHex: "#111111",
    fabric: "leather",
    formalityLevel: 4,
    season: "all",
  }),
  wardrobeItem("ankle-boots", {
    category: "footwear",
    subcategory: "waterproof ankle boots",
    colorPrimary: "brown",
    colorHex: "#4F2E16",
    fabric: "leather",
    formalityLevel: 3,
    season: "fall",
  }),
  wardrobeItem("winter-boots", {
    category: "footwear",
    subcategory: "insulated winter boots",
    colorPrimary: "black",
    colorHex: "#111111",
    fabric: "leather",
    formalityLevel: 2,
    season: "winter",
  }),
  wardrobeItem("sandals", {
    category: "footwear",
    subcategory: "strappy sandals",
    colorPrimary: "tan",
    colorHex: "#B78352",
    fabric: "leather",
    formalityLevel: 2,
    season: "summer",
  }),
  wardrobeItem("red-blouse", {
    category: "tops",
    subcategory: "red statement blouse",
    colorPrimary: "red",
    colorHex: "#C22B2B",
    pattern: "solid",
    fabric: "silk",
    formalityLevel: 3,
    season: "all",
  }),
  wardrobeItem("plaid-skirt", {
    category: "skirts",
    subcategory: "plaid midi skirt",
    colorPrimary: "navy",
    colorHex: "#1A2B49",
    pattern: "plaid",
    fabric: "wool",
    formalityLevel: 3,
    season: "fall",
  }),
];

function ctx(
  overrides: Partial<StylistScenarioContext> = {},
): StylistScenarioContext {
  return {
    mood: { energy: 50, boldness: 50 },
    weatherSeason: "fall",
    temp: 12,
    condition: "Clouds",
    precipMm: 0,
    formalityRange: { min: 1, max: 5 },
    persona: "classic",
    colorSeason: "True Winter",
    colorPalette: [{ name: "Navy", hex: "#1C2F4A" }],
    avoidColors: [{ name: "Mustard", hex: "#D4A017" }],
    genderMode: "neutral",
    ...overrides,
  };
}

export const STYLIST_EVALUATION_SCENARIOS: StylistEvaluationScenario[] = [
  {
    id: "winter-rain-office-classic",
    title: "Cold rainy office day",
    context: ctx({
      weatherSeason: "winter",
      temp: 2,
      condition: "Rain",
      precipMm: 8,
      formalityRange: { min: 3, max: 5 },
      persona: "classic",
    }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 4,
      minRulesOnlyOutfits: 1,
      mustUseCategory: "outerwear",
      mustAvoidItemId: "sandals",
      note: "Must include warm outerwear and closed footwear.",
    },
  },
  {
    id: "summer-heat-sassy",
    title: "35C heatwave with bold mood",
    context: ctx({
      weatherSeason: "summer",
      temp: 35,
      condition: "Clear",
      precipMm: 0,
      mood: { energy: 70, boldness: 85 },
      formalityRange: { min: 1, max: 3 },
      persona: "sassy",
    }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 4,
      minRulesOnlyOutfits: 1,
      mustAvoidItemId: "wool-coat",
      note: "Must avoid heavy fabrics and can use a statement item.",
    },
  },
  {
    id: "first-date-kind",
    title: "Kind persona for a date",
    context: ctx({
      temp: 18,
      weatherSeason: "spring",
      mood: { energy: 55, boldness: 60 },
      formalityRange: { min: 2, max: 4 },
      persona: "kind",
    }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 5,
      minRulesOnlyOutfits: 1,
      note: "Should balance softness and polish.",
    },
  },
  {
    id: "male-office-manly",
    title: "Manly persona for office",
    context: ctx({
      temp: 10,
      weatherSeason: "fall",
      formalityRange: { min: 3, max: 5 },
      persona: "manly",
      genderMode: "male",
    }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 5,
      minRulesOnlyOutfits: 1,
      note: "Should prefer practical polished basics.",
    },
  },
  {
    id: "small-wardrobe-no-shoes",
    title: "Tiny wardrobe without footwear",
    context: ctx({ temp: 20, weatherSeason: "spring" }),
    wardrobe: [
      wardrobeItem("only-top", { category: "tops", season: "all" }),
      wardrobeItem("only-jeans", { category: "jeans", season: "all" }),
    ],
    expected: {
      minCandidates: 2,
      minRulesOnlyOutfits: 0,
      note: "Should explain that footwear is missing.",
    },
  },
  {
    id: "rain-with-no-rain-footwear",
    title: "Rain when only sandals are available",
    context: ctx({ temp: 22, weatherSeason: "summer", condition: "Rain", precipMm: 5 }),
    wardrobe: [
      wardrobeItem("rain-top", { category: "tops", season: "summer" }),
      wardrobeItem("rain-jeans", { category: "jeans", season: "all" }),
      wardrobeItem("rain-sandals", {
        category: "footwear",
        subcategory: "sandals",
        season: "summer",
        fabric: "leather",
      }),
    ],
    expected: {
      minCandidates: 2,
      minRulesOnlyOutfits: 0,
      mustAvoidItemId: "rain-sandals",
      note: "Should reject sandals in wet weather and tell the user why.",
    },
  },
  {
    id: "misclassified-summer-puffer",
    title: "Puffer wrongly tagged as summer",
    context: ctx({ temp: 27, weatherSeason: "summer" }),
    wardrobe: [
      wardrobeItem("summer-top", { category: "tops", season: "summer", fabric: "linen" }),
      wardrobeItem("summer-pants", { category: "pants", season: "summer", fabric: "cotton" }),
      wardrobeItem("summer-shoes", { category: "footwear", season: "summer", fabric: "leather" }),
      wardrobeItem("bad-puffer", {
        category: "outerwear",
        subcategory: "puffer jacket",
        season: "summer",
        fabric: "polyester",
        tags: { needsReview: true, reviewReasons: ["outerwear_summer_conflict"] },
      }),
    ],
    expected: {
      minCandidates: 3,
      minRulesOnlyOutfits: 1,
      mustAvoidItemId: "bad-puffer",
      note: "Regression scenario for the winter jacket bug.",
    },
  },
  ...(["classic", "sassy", "manly", "kind"] as const).map((persona) => ({
    id: `persona-tone-${persona}`,
    title: `Persona coverage: ${persona}`,
    context: ctx({
      persona,
      temp: 16,
      weatherSeason: "spring",
      mood: persona === "sassy"
        ? { energy: 70, boldness: 80 }
        : { energy: 45, boldness: 45 },
    }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 5,
      minRulesOnlyOutfits: 1,
      note: "Persona should affect tone and later v2 scoring.",
    },
  })),
  {
    id: "avoid-color-mustard",
    title: "Avoid colors from user palette",
    context: ctx({ temp: 18, weatherSeason: "spring" }),
    wardrobe: [
      ...baseWardrobe,
      wardrobeItem("mustard-cardigan", {
        category: "tops",
        colorPrimary: "mustard",
        colorHex: "#D4A017",
        season: "all",
      }),
    ],
    expected: {
      minCandidates: 5,
      mustAvoidItemId: "mustard-cardigan",
      note: "Avoid color should be removed before styling.",
    },
  },
  {
    id: "formal-event-dress",
    title: "Formal event can use dress + footwear",
    context: ctx({ temp: 19, weatherSeason: "spring", formalityRange: { min: 4, max: 5 } }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 3,
      minRulesOnlyOutfits: 1,
      note: "Dress outfit should be valid for formal contexts.",
    },
  },
  {
    id: "athletic-low-formality",
    title: "Low formality active day",
    context: ctx({ temp: 14, weatherSeason: "fall", formalityRange: { min: 1, max: 2 } }),
    wardrobe: [
      ...baseWardrobe,
      wardrobeItem("running-top", { category: "sportswear", season: "all", formalityLevel: 1 }),
      wardrobeItem("running-tights", { category: "sportswear", season: "all", formalityLevel: 1 }),
    ],
    expected: {
      minCandidates: 4,
      note: "Should not force office pieces into low formality.",
    },
  },
  {
    id: "recent-items-relaxed",
    title: "Recently worn items need relaxation path",
    context: ctx({ temp: 12, weatherSeason: "fall" }),
    wardrobe: baseWardrobe.map((item) => ({
      ...item,
      lastWornAt: new Date(),
    })),
    expected: {
      minCandidates: 0,
      note: "Primary pass should remove recent items; API can relax later.",
    },
  },
  {
    id: "no-location-proxy",
    title: "No location branch proxy scenario",
    context: ctx({ temp: 20, weatherSeason: "spring" }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 5,
      note: "Route-level scenario; harness keeps wardrobe/weather valid.",
    },
  },
  {
    id: "spring-trench-layer",
    title: "Spring layering without heavy coat",
    context: ctx({ temp: 13, weatherSeason: "fall", condition: "Clouds" }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 5,
      minRulesOnlyOutfits: 1,
      mustUseCategory: "outerwear",
      mustAvoidItemId: "wool-coat",
      note: "Light outerwear is better than winter wool coat.",
    },
  },
  {
    id: "monochrome-classic",
    title: "Classic monochrome office",
    context: ctx({ temp: 21, weatherSeason: "spring", formalityRange: { min: 3, max: 5 } }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 5,
      minRulesOnlyOutfits: 1,
      note: "Should build a restrained office look.",
    },
  },
  {
    id: "bold-pattern-limit",
    title: "Bold mood with print limit",
    context: ctx({ temp: 16, weatherSeason: "fall", mood: { energy: 70, boldness: 90 } }),
    wardrobe: [
      ...baseWardrobe,
      wardrobeItem("floral-top", {
        category: "tops",
        pattern: "floral",
        colorPrimary: "pink",
        colorHex: "#D483A0",
        season: "all",
      }),
    ],
    expected: {
      minCandidates: 6,
      note: "Should not combine several strong patterns.",
    },
  },
  {
    id: "snow-day",
    title: "Snow day requires boots and warmth",
    context: ctx({ temp: -4, weatherSeason: "winter", condition: "Snow", precipMm: 10 }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 4,
      minRulesOnlyOutfits: 1,
      mustUseCategory: "outerwear",
      mustAvoidItemId: "sandals",
      note: "Snow requires insulation and closed footwear.",
    },
  },
  {
    id: "wardrobe-too-small-formal",
    title: "Small wardrobe too casual for formal",
    context: ctx({ temp: 18, weatherSeason: "spring", formalityRange: { min: 5, max: 5 } }),
    wardrobe: [
      wardrobeItem("casual-tee", { category: "tops", formalityLevel: 1 }),
      wardrobeItem("casual-jeans", { category: "jeans", formalityLevel: 1 }),
      wardrobeItem("casual-sneakers", { category: "footwear", formalityLevel: 1 }),
    ],
    expected: {
      minCandidates: 0,
      minRulesOnlyOutfits: 0,
      note: "Should honestly report that the wardrobe is too casual.",
    },
  },
  {
    id: "comfort-kind",
    title: "Kind persona comfort day",
    context: ctx({
      temp: 9,
      weatherSeason: "fall",
      persona: "kind",
      mood: { energy: 25, boldness: 25 },
      formalityRange: { min: 1, max: 3 },
    }),
    wardrobe: baseWardrobe,
    expected: {
      minCandidates: 4,
      note: "Should prefer comfort without ignoring weather.",
    },
  },
];
