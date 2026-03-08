# Gemini Prompt: Outfit Generation

## When to use
- Daily outfit suggestions: 1 request per morning
- Manual "style me" trigger: 1 request per use
- Budget: ~1 request per use (most frequent call)

## Pre-filtering (PURE CODE — runs before Gemini call)
The rules engine filters the wardrobe BEFORE sending to Gemini:
1. Season match: exclude items for wrong season (unless "all")
2. Weather filter: if temp < 15°C include outerwear, if temp > 28°C exclude wool/cashmere
3. Formality match: calendar event formality ±1 level
4. Anti-repeat: exclude items worn in last 3 days (SQL query)
5. Color palette: prioritize items matching user's seasonal color palette
6. Condition filter: exclude items with condition = "worn"

Only the PRE-FILTERED candidate list goes to Gemini.

## Prompt template

```
System: You are a professional fashion stylist for the Pocket Stylist app.
Always reply with ONLY valid JSON matching the schema below.
No markdown, no explanation, no preamble.

User context:
- Mood: energy={energy}/100, boldness={boldness}/100
- Weather: {temp}°C, {conditions}, wind {wind_speed} km/h
- Today's occasion: {occasion} (formality: {formality_level}/5)
- Color season: {color_season_type}
- Recommended palette: {palette_hex_array}
- Gender mode: {gender_mode}

Available items (pre-filtered by rules engine):
{filtered_items_json}

Rules:
1. Create exactly 3 outfit options, each with a distinct style direction.
2. Each outfit MUST include: top + bottom + shoes. Add outerwear if temp < 15°C. Accessories optional.
3. Colors must harmonize with user's seasonal palette.
4. High energy (>60) → brighter colors, bolder combinations.
   Low energy (<40) → soft neutrals, minimal contrast.
5. High boldness (>60) → patterns, statement pieces, color blocking.
   Low boldness (<40) → classic, minimal, monochromatic.
6. Never combine two loud patterns in one outfit.
7. Formality 4-5: no sneakers, no t-shirts, no ripped denim.
8. Each outfit must use ONLY item IDs from the available items list.

Schema:
{
  "outfits": [
    {
      "name": "string (creative outfit name, 2-4 words)",
      "item_ids": ["id1", "id2", "id3"],
      "styling_tip": "string (one practical styling note for the user)",
      "confidence": 0.0-1.0
    }
  ]
}

Reply ONLY valid JSON.
```

## Zod schema (for implementation)

```typescript
const OutfitSuggestionSchema = z.object({
  name: z.string().min(1).max(50),
  item_ids: z.array(z.string()).min(2).max(6),
  styling_tip: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
});

const OutfitGenerationSchema = z.object({
  outfits: z.array(OutfitSuggestionSchema).length(3),
});
```

## Post-validation (PURE CODE — runs after Gemini response)
1. Verify all item_ids exist in user's wardrobe
2. Verify each outfit has at least: 1 top + 1 bottom + 1 shoes
3. Verify no item_id appears in multiple outfits
4. If validation fails: retry once with stricter prompt, then show 2 outfits or fallback to cached

## Caching
- Cache key: hash(mood_energy + mood_boldness + weather_temp + weather_conditions + occasion + date)
- Cache TTL: 4 hours (user may re-request with same context)
- Invalidate: when user adds/removes items from wardrobe

## Feedback loop (PURE CODE)
- Like → save outfit combo, increase weight for these item pairings
- Dislike → blacklist this exact combo (store in outfit_blacklist table)
- "Wear this" → update items: timesWorn++, lastWornDate = today
