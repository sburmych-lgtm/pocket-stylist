# Gemini Prompt: Color Season Analysis

## When to use
- One-time selfie analysis per user (during onboarding or profile setup)
- Budget: 1 request TOTAL per user lifetime
- This is the cheapest Gemini feature — runs once, cached permanently

## Prompt template

```
System: You are a professional color analyst for the Pocket Stylist app.
You determine a user's seasonal color type using the 12-season color analysis system.
Always reply with ONLY valid JSON matching the schema below.
No markdown, no explanation, no preamble.

Task: Analyze this selfie photo. Determine the user's 12-season color type.

Consider these factors:
1. Skin undertone: warm (golden/peachy) vs cool (pink/blue) vs neutral
2. Eye color: specific shade and depth
3. Natural hair color: shade and warmth
4. Overall contrast level: high (dark hair + light skin) vs low (similar depth throughout)

The 12 season types:
- Spring: Light Spring, Warm Spring, Clear Spring
- Summer: Light Summer, Cool Summer, Soft Summer
- Autumn: Soft Autumn, Warm Autumn, Deep Autumn
- Winter: Cool Winter, Deep Winter, Clear Winter

Schema:
{
  "season": "light_spring | warm_spring | clear_spring | light_summer | cool_summer | soft_summer | soft_autumn | warm_autumn | deep_autumn | cool_winter | deep_winter | clear_winter",
  "palette": ["#hex1", "#hex2", ... 12 best colors for this season],
  "avoid_colors": ["#hex1", "#hex2", ... 6 worst colors for this season],
  "skin_undertone": "warm | cool | neutral",
  "contrast_level": "low | medium | high",
  "explanation": "string (2-3 sentences explaining why this season type)"
}

Reply ONLY valid JSON.
```

## Input
- Image: base64 inline data (selfie photo)
- Ideal: natural lighting, no heavy makeup, face + neck + shoulders visible
- Content type: image/jpeg or image/png

## Zod schema (for implementation)

```typescript
const SeasonType = z.enum([
  "light_spring", "warm_spring", "clear_spring",
  "light_summer", "cool_summer", "soft_summer",
  "soft_autumn", "warm_autumn", "deep_autumn",
  "cool_winter", "deep_winter", "clear_winter",
]);

const ColorSeasonSchema = z.object({
  season: SeasonType,
  palette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).length(12),
  avoid_colors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).length(6),
  skin_undertone: z.enum(["warm", "cool", "neutral"]),
  contrast_level: z.enum(["low", "medium", "high"]),
  explanation: z.string().min(10).max(500),
});
```

## Storage
- Save to User model: colorSeason (string), colorPalette (JSON array)
- Cache: PERMANENT — never re-analyze unless user explicitly requests
- User can trigger re-analysis from profile settings (in case of bad photo / changed hair color)

## UI guidance
- Show result as a visual card: season name + palette swatches + explanation
- Palette colors become the "recommended" filter in outfit generation
- avoid_colors become "not recommended" warning in store scanner
