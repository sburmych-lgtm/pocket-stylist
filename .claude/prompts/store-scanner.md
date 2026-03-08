# Gemini Prompt: In-Store Scanner Verdict

## When to use
- User photographs an item on a store hanger/rack
- App gives BUY / SKIP / CONSIDER verdict
- Budget: 1 request per scanned item

## Two-step flow

### Step 1: Item identification (Gemini call)
Use the clothing-analysis.md prompt to identify the scanned item.
This returns: category, color, pattern, fabric, formality, season.

### Step 2: Verdict generation (Gemini call — can be combined with step 1)

#### Pre-processing (PURE CODE — before Gemini):
1. pgvector cosine similarity: find top 5 most similar items in user's wardrobe
2. If similarity > 0.85 for any item → pre-flag "very similar item exists"
3. Count items by category in wardrobe (e.g., user has 12 tops, 3 bottoms)
4. Calculate wardrobe gaps: compare distribution vs calendar event types

## Combined prompt template (steps 1+2 in single request)

```
System: You are a smart shopping advisor for the Pocket Stylist app.
The user is in a store looking at an item. Analyze the item AND advise whether to buy it.
Always reply with ONLY valid JSON matching the schema below.
No markdown, no explanation, no preamble.

User's wardrobe summary:
- Total items: {total_count}
- By category: {categories_json} (e.g. {"top": 12, "bottom": 3, "shoes": 5})
- Color season: {color_season}
- Recommended palette: {palette_hex_array}
- Most similar existing items: {similar_items_json}

Task:
1. Identify the item in the photo (category, color, pattern, fabric).
2. Determine if it fills a wardrobe gap or duplicates existing items.
3. Estimate how many NEW outfit combinations this item enables.
4. Project cost-per-wear if worn {expected_frequency} times in 12 months at {estimated_price}.

Schema:
{
  "item": {
    "category": "top | bottom | outerwear | shoes | accessory",
    "subcategory": "string",
    "color_primary": "CSS color name",
    "color_hex": "#RRGGBB",
    "pattern": "solid | striped | plaid | floral | print | geometric",
    "fabric": "string",
    "estimated_price_range": "string (e.g. '$30-50')"
  },
  "verdict": "BUY | SKIP | CONSIDER",
  "reason": "string (1-2 sentences explaining the verdict)",
  "wardrobe_gap": true | false,
  "gap_explanation": "string (what gap this fills, or null if no gap)",
  "new_outfits_possible": 0-20,
  "similar_items_count": 0-10,
  "compatibility_score": 0-100,
  "cost_per_wear_projected": 0.00,
  "palette_match": true | false
}

Verdict rules:
- BUY: fills a gap AND matches color season AND enables 3+ new outfits
- SKIP: duplicates existing items OR clashes with color season OR enables <2 outfits
- CONSIDER: some pros and cons, user should decide

Reply ONLY valid JSON.
```

## Zod schema (for implementation)

```typescript
const ScannedItemSchema = z.object({
  category: z.enum(["top", "bottom", "outerwear", "shoes", "accessory"]),
  subcategory: z.string().min(1),
  color_primary: z.string().min(1),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  pattern: z.enum(["solid", "striped", "plaid", "floral", "print", "geometric"]),
  fabric: z.string().min(1),
  estimated_price_range: z.string(),
});

const ScannerVerdictSchema = z.object({
  item: ScannedItemSchema,
  verdict: z.enum(["BUY", "SKIP", "CONSIDER"]),
  reason: z.string().min(1).max(300),
  wardrobe_gap: z.boolean(),
  gap_explanation: z.string().nullable(),
  new_outfits_possible: z.number().int().min(0).max(20),
  similar_items_count: z.number().int().min(0).max(10),
  compatibility_score: z.number().int().min(0).max(100),
  cost_per_wear_projected: z.number().min(0),
  palette_match: z.boolean(),
});
```

## Caching
- No caching — each scan is unique (different item, potentially different wardrobe state)
- But: reuse wardrobe summary cache (refresh every 5 minutes max)

## UI verdict display
- BUY → green glow, checkmark icon, show "new outfits possible" count
- SKIP → red subtle, X icon, show "similar items you own" carousel
- CONSIDER → gold/amber, ? icon, show pros/cons breakdown
