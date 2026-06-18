---
name: analyze-ai-prompts
description: Analyze AI prompts, Gemini API integration, and outfit generation logic in the Pocket Stylist app. Use this skill when the user asks about how AI works in the app, wants to review or modify prompts, asks about outfit/look generation logic, wants to understand the styling engine, or needs to optimize Gemini API usage. Triggers on "how does AI generate outfits", "show me the prompts", "change the prompt", "how does styling work", "outfit generation logic", or "Gemini integration".
---

# Analyze AI Prompts

Deep-dive into the AI/Gemini integration, prompt templates, and outfit generation logic.

## Files to analyze

Read ALL of these files to build a complete picture:

### Core AI services
```
server/services/gemini.ts                    — Gemini API client, clothing photo analysis
server/services/color-analysis.ts            — Color season analysis from selfies
server/services/styling/outfit-generator.ts  — Outfit generation with Gemini
server/services/styling/rules-engine.ts      — Pure-code wardrobe filtering (no API)
server/services/styling/weather.ts           — Weather context for outfits
```

### Prompt templates
```
.claude/prompts/clothing-analysis.md    — Clothing photo analysis prompt
.claude/prompts/color-season.md         — Color seasonal type determination
.claude/prompts/outfit-generation.md    — Outfit combination generation
.claude/prompts/store-scanner.md        — Shopping verdict (BUY/SKIP/CONSIDER)
```

### API endpoints that use AI
```
server/api/import.ts     — POST /api/import/analyze (uses gemini.ts)
server/api/styling.ts    — POST /api/styling/suggest (uses outfit-generator.ts)
server/api/scanner.ts    — POST /api/scanner/analyze (uses gemini.ts)
server/api/profile.ts    — POST /api/profile/color-analysis (uses color-analysis.ts)
```

### Validation schemas
```
src/types/wardrobe.ts    — TypeScript types for wardrobe items
```

## Analysis framework

For each AI integration point, document:

### 1. Prompt analysis

For each prompt, extract and report:

| Field | Details |
|-------|---------|
| **Location** | File path and line numbers |
| **Purpose** | What the prompt does |
| **Input** | What data is sent to Gemini |
| **Output schema** | Expected JSON structure |
| **Validation** | Zod schema used (if any) |
| **Fallback** | What happens on failure/timeout |
| **Token estimate** | Approximate input/output tokens |
| **Hardcoded vs template** | Is the prompt inline or loaded from .claude/prompts/ |

### 2. Hybrid engine analysis

Document the split between code and AI:

**Pure code (rules-engine.ts):**
- What filtering/matching logic runs without API calls
- Color compatibility algorithms
- Season/weather filtering rules
- Formality matching logic
- Anti-repeat / recency logic
- Cost-per-wear calculations

**Gemini-powered:**
- What specifically requires Gemini
- Could any Gemini calls be replaced with code logic
- Are there unnecessary API calls

### 3. Prompt quality assessment

For each prompt, evaluate:

- **Specificity**: Does it give Gemini enough context to produce good results?
- **Output format**: Is JSON schema clearly specified?
- **Edge cases**: Does it handle unusual inputs (no items, single item, all same category)?
- **Personalization**: Does it use user's color season, preferences, body type?
- **Language**: Is the prompt in English (best for Gemini) even if UI is multilingual?
- **Token efficiency**: Is the prompt bloated with unnecessary instructions?

### 4. Improvement opportunities

Identify and suggest:
- Prompts that could benefit from few-shot examples
- Missing context that would improve outfit quality (weather, occasion, user history)
- Prompt chaining opportunities (e.g., analyze → generate → refine)
- Caching strategies to reduce API calls
- Better fallback behavior

## Report format

```
## AI Integration Analysis Report

### Summary
- Total Gemini integration points: [N]
- Prompt templates: [N] (inline: [N], external: [N])
- Daily API budget: 1,500 req/day (Gemini 2.5 Flash free tier)
- Estimated calls per user session: [N]

### 1. Clothing Photo Analysis
**File:** server/services/gemini.ts:[lines]
**Prompt:** [full prompt text or summary]
**Input:** base64 image + mimeType
**Output:** { category, subcategory, colorPrimary, ... }
**Validation:** [Zod schema details]
**Quality:** [rating] — [notes]
**Suggestions:** [improvements]

### 2. Color Season Analysis
[same structure]

### 3. Outfit Generation
[same structure]

### 4. Store Scanner
[same structure]

### Hybrid Engine Breakdown
| Logic | Method | Rationale |
|-------|--------|-----------|
| Color matching | Pure code | Deterministic, no API needed |
| Weather filtering | Pure code | Simple rules |
| ... | ... | ... |

### Recommendations
1. [Prioritized list of improvements]
```

## Modifying prompts

If the user wants to change a prompt:

1. Show the current prompt in full
2. Discuss the proposed change and its impact
3. Edit the prompt file (inline in code or in `.claude/prompts/`)
4. Run `npm run typecheck` to verify no schema mismatches
5. Test with a sample image/request if possible
6. Warn about Zod validation — if the prompt output format changes, update the Zod schema too

The prompts MUST always end with: `"Reply ONLY valid JSON. No markdown, no explanation."` — this is critical for reliable parsing.
