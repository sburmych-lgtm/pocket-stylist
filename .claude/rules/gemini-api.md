---
paths:
  - "**/gemini*.ts"
  - "**/services/**"
---
# Gemini API rules (Free Tier — 1,500 req/day)

## Model
- Use model: "gemini-2.5-flash" via @google/generative-ai SDK.
- Initialize once: const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

## Request discipline
- Every call MUST have Zod schema validation on response.
- Every call MUST have 10s timeout with AbortController + fallback to cached data.
- Never trust Gemini output directly — parse with JSON.parse, validate with Zod, then use.
- Prompts end with: "Reply ONLY valid JSON. No markdown, no explanation."
- Include explicit enum values in prompts (category, pattern, fabric, season).
- Log token usage per request type for daily budget tracking.
- Rate limit: max 10 req/sec burst, 500/min sustained.
- Batch multiple items in single prompt when possible (e.g., bulk photo tagging).
- For images: send base64 inline data, not URLs (more reliable with Gemini).
- Confidence < 0.7 → flag item yellow for user review, never auto-accept.

## Caching strategy
- Weather data: cache 1 hour (OpenWeatherMap).
- Calendar events: cache 1 hour (Google Calendar).
- Color season analysis: cache permanently per user (one-time selfie analysis).
- Clothing item tags: cache permanently once confidence >= 0.7.
- Outfit suggestions: cache per context hash (mood + weather + calendar combo).

## Hybrid engine (CRITICAL — saves API budget)
- NEVER call Gemini for operations doable with pure code:
  - Color wheel compatibility matching → hardcoded rules.
  - Season/weather filtering → if/else logic.
  - Formality filtering → numeric comparison.
  - Anti-repeat logic → SQL query (exclude recently worn).
  - Cost-per-wear → simple division (price / timesWorn).
  - Gap analysis → wardrobe distribution vs calendar distribution.
  - Sorting, ranking, deduplication → array operations.
- ALWAYS call Gemini for (prompt templates in .claude/prompts/):
  - Photo analysis → .claude/prompts/clothing-analysis.md
  - Outfit generation → .claude/prompts/outfit-generation.md
  - Color season analysis → .claude/prompts/color-season.md
  - Store scanner verdict → .claude/prompts/store-scanner.md
  - Celebrity look decomposition (use clothing-analysis.md prompt adapted for reference photos).

## Error handling
- On Gemini 429 (rate limit): exponential backoff, max 3 retries.
- On Gemini 500: return cached data or graceful degradation message.
- On invalid JSON response: retry once with stricter prompt, then fallback.
- On daily budget exhaustion: disable smart features, show "Try again tomorrow" message.
- Track daily request count in DB or Redis — warn at 80% (1,200 requests).
