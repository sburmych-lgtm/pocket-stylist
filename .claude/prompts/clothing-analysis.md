# Gemini Prompt: Clothing Photo Analysis

## When to use
- Bulk photo import (onboarding): 1 request per 5 items (batch)
- Single item add: 1 request per photo
- Budget: ~1 request per use

## Prompt template

```
System: You are a fashion AI for the Pocket Stylist app.
Always reply with ONLY valid JSON matching the schema below.
No markdown, no explanation, no preamble.

Schema:
{
  "items": [
    {
      "category": "top | bottom | outerwear | shoes | accessory",
      "subcategory": "string (e.g. t-shirt, blazer, jeans, sneakers, scarf)",
      "color_primary": "CSS color name (e.g. navy, coral, ivory, charcoal)",
      "color_hex": "#RRGGBB",
      "pattern": "solid | striped | plaid | floral | print | geometric | animal | abstract",
      "fabric": "cotton | polyester | wool | silk | denim | leather | linen | synthetic | cashmere | velvet",
      "formality_level": "1-5 integer (1=loungewear, 2=casual, 3=smart-casual, 4=business, 5=formal)",
      "season": "spring | summer | autumn | winter | all",
      "brand_if_visible": "string or null",
      "confidence": "0.0-1.0 float"
    }
  ]
}

Task: Analyze this clothing photo. Return a JSON array for each distinct item visible.
If multiple items are in the photo, return one object per item.
For color, use the most specific CSS color name (e.g. "coral" not "orange", "navy" not "blue").
```

## Input
- Image: base64 inline data (not URL)
- Content type: image/jpeg or image/png

## Zod schema (for implementation)

```typescript
const ClothingItemSchema = z.object({
  category: z.enum(["top", "bottom", "outerwear", "shoes", "accessory"]),
  subcategory: z.string().min(1),
  color_primary: z.string().min(1),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  pattern: z.enum(["solid", "striped", "plaid", "floral", "print", "geometric", "animal", "abstract"]),
  fabric: z.enum(["cotton", "polyester", "wool", "silk", "denim", "leather", "linen", "synthetic", "cashmere", "velvet"]),
  formality_level: z.number().int().min(1).max(5),
  season: z.enum(["spring", "summer", "autumn", "winter", "all"]),
  brand_if_visible: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const ClothingAnalysisSchema = z.object({
  items: z.array(ClothingItemSchema).min(1),
});
```

## Caching
- Permanent per item once confidence >= 0.7
- Items with confidence < 0.7: flag yellow for user review, allow manual correction

## Batching
- For bulk import: send up to 5 images in a single Gemini request
- Prompt adjustment for batch: "Analyze these {N} clothing photos. Return one JSON array per image, wrapped in: { \"images\": [ { \"items\": [...] }, ... ] }"
