# Pocket Stylist — Build Pipeline

## Architecture overview
```
DEV:  Claude Code → full app (code + basic UI) → git push → GitHub → Railway auto-deploy
THEN: Codex Desktop → restyle UI (.tsx only) → git push → Railway re-deploy

PROD: User opens PWA → hybrid engine (pure code rules + Gemini 2.5 Flash Free API)
      No OpenAI, no Claude API in production — only Gemini Free Tier (1,500 req/day)
```

## Hybrid AI engine
- FREE (pure code, unlimited): color matching, weather filtering, formality filtering, anti-repeat logic, cost-per-wear, gap analysis, sorting/ranking
- GEMINI (1,500/day budget): photo analysis, outfit generation, color season analysis, store scanner, celebrity matching, wear audit

---

## Phase 0 — Project Setup
**Scope**: Scaffolding, DB schema, environment, deployment pipeline.
**Steps**:
1. Create .gitignore (node_modules, dist, .env, .env.*, .claude/plan.md, .claude/changes.md, .claude/blockers.md)
2. Obtain API keys: check G:\Веб-додатки\api-keys.txt first, fetch missing keys via Playwright browser (aistudio.google.com, console.cloudinary.com, openweathermap.org, console.cloud.google.com)
3. Create .env with all keys + generate SESSION_SECRET via crypto.randomBytes(64)
4. Create .env.example with placeholder values (YOUR_KEY_HERE) for documentation
5. Scaffold: npm create vite@latest -- --template react-ts
6. Install deps: tailwindcss, prisma, express, zod, @google/generative-ai, cloudinary, workbox
7. Init Prisma with PostgreSQL + pgvector extension
8. Create DB schema: User, WardrobeItem (with vector(768) embedding), Outfit
9. Run /interface-design:init to establish design system
10. Create GitHub repo "pocket-stylist" via Playwright browser, push initial commit
11. Connect Railway to GitHub via Playwright: new project → add PostgreSQL addon → set ALL env vars (use Railway's DATABASE_URL)
12. Verify: push → Railway deploys → app loads at URL
**Key files**: .gitignore, .env.example, prisma/schema.prisma, src/app.ts, vite.config.ts, tailwind.config.ts, package.json
**Success**: App loads at Railway URL, Prisma connects to PostgreSQL, .env NOT in git

---

## Phase 1 — Zero-Friction Import
**Scope**: Digitize 100+ clothing items in under 15 minutes. THIS is problem #1.
**Steps**:
1. Bulk photo upload: drag-and-drop, up to 50 photos at once
2. Cloudinary upload service: resize, optimize, generate thumbnails
3. Gemini auto-tagging: category, color, pattern, fabric, formality, season
4. Review UI: editable tag cards, confidence indicators (yellow if <0.7)
5. Progress tracking: item count, success/fail status
**Key files**: src/components/import/*, src/api/import.ts, src/services/gemini-service.ts, src/services/cloudinary-service.ts
**Success**: Upload 20 photos → all tagged in <2 min, >80% correct category, >70% correct color

---

## Phase 2 — Context-Aware Styling Engine
**Scope**: Mood + weather + calendar + color season = personalized daily outfits.
**Steps**:
1. Mood input: two sliders (energy 0-100, boldness 0-100)
2. Weather service: OpenWeatherMap integration with 1hr cache
3. Calendar service: Google Calendar OAuth + event analysis
4. Color season analysis: one-time selfie → 12-season type (Gemini)
5. Rules engine (pure code): filter by season, formality, recently worn, color palette
6. Outfit generator (Gemini): 3 outfit options from pre-filtered candidates
7. Feedback loop: like/dislike/wear → influences future suggestions
**Key files**: src/components/styling/*, src/services/styling/*, src/services/weather-service.ts, src/services/calendar-service.ts
**Success**: Get 3 outfit suggestions matching weather + calendar + mood, feedback saves correctly

---

## Phase 3 — In-Store Scanner + Virtual Try-On
**Scope**: Photograph item in store → BUY/SKIP verdict. Zero competitors have this.
**Steps**:
1. Camera scanner: full-screen camera capture component
2. Gemini item identification from photo
3. pgvector similarity search vs user's wardrobe (cosine distance)
4. Verdict logic: gap analysis + new outfit count + cost-per-wear projection
5. Virtual try-on: Gemini image generation (base selfie + selected outfit), 5/day limit
**Key files**: src/components/scanner/*, src/components/tryon/*, src/api/scanner.ts, src/api/tryon.ts
**Success**: Scan item → get BUY/SKIP verdict with explanation in <5 sec

---

## Phase 4 — Celebrity Matching + Family Hub
**Scope**: Upload any photo → AI recreates the look from YOUR closet. Family wardrobes.
**Steps**:
1. Reference photo upload + Gemini decomposition into garments
2. Per-category embedding similarity search
3. Recreation assembler: 2-3 options from best matches
4. Family data model: families, family_members (admin/member/child roles)
5. Family wardrobe view: admin sees all wardrobes, parent picks outfits for kids
6. Couple coordination: color clash detection
**Key files**: src/components/matching/*, src/components/family/*, src/api/matching.ts, src/api/family.ts
**Success**: Upload celebrity photo → get 2+ recreated looks from own wardrobe

---

## Phase 5 — Analytics + Gamification
**Scope**: Wardrobe intelligence dashboard (all pure code, no Gemini).
**Steps**:
1. Cost-per-wear calculator for every item
2. Dead zone detector: items not worn 90+ days → "Sell this?"
3. Gap analysis: wardrobe distribution vs calendar event distribution
4. Eco dashboard: CO2 footprint by fabric type, comparison metrics
5. Gamification: challenges ("Capsule 15", "Week without black"), badges, points
6. Male optimizer mode: numbers over emotions, direct occasion picker
**Key files**: src/components/analytics/*, src/services/analytics-service.ts, src/utils/eco-calculator.ts
**Success**: Dashboard shows accurate cost-per-wear, gap analysis, eco metrics

---

## Phase 6 — Codex Restyle (Manual)
User manually runs Codex Desktop with .claude/codex-handoff/restyle-prompt.md.
NOT executed by Claude Code.

---

## Railway env vars required
DATABASE_URL, GEMINI_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENWEATHER_API_KEY, SESSION_SECRET
