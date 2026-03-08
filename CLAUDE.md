# Pocket Stylist — AI Wardrobe PWA

## Build and test commands
- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run test -- path/to/test` — Run single test (prefer this)
- `npm run test` — Full test suite (before commits only)
- `npm run lint` — ESLint + Prettier check
- `npm run typecheck` — TypeScript strict check
- `npx prisma migrate dev` — Apply DB migrations
- `npx prisma generate` — Regenerate Prisma client
- `npx prisma studio` — Visual DB browser

## Tech stack
- Frontend: React 19 + TypeScript + Vite + TailwindCSS + PWA (workbox)
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma ORM + pgvector
- AI: Gemini 2.5 Flash free tier (1,500 req/day) via @google/generative-ai
- Images: Cloudinary free tier
- APIs: Google Calendar, OpenWeatherMap, Gmail
- Deploy: GitHub → Railway (auto-deploy on push to main)

## Architecture
- src/components/ — React UI grouped by feature (import/, styling/, scanner/, analytics/)
- src/pages/ — Route-level page components
- src/hooks/ — Custom React hooks
- src/api/ — Express API routes
- src/services/ — Business logic (gemini, weather, calendar, cloudinary)
- src/services/styling/ — Hybrid outfit engine (pure code rules + Gemini)
- src/db/ — Prisma schema, migrations, seed
- src/types/ — TypeScript types + Zod schemas
- src/utils/ — Helpers (color math, embeddings, image processing)
- public/ — PWA manifest, icons, service worker registration

## Code style
- TypeScript strict mode, explicit return types on exports
- Zod validation for ALL external data (API input, Gemini output, user input)
- Async/await everywhere, never callbacks
- React: functional components, custom hooks for logic extraction
- TailwindCSS utilities only, no CSS-in-JS, no inline styles
- PascalCase component files, kebab-case service files

## Gemini API (critical — see .claude/rules/gemini-api.md for full spec)
- Hybrid engine: simple logic (color match, filter, math) = pure code, NO API call
- Gemini ONLY for: photo analysis, outfit generation, color season, store scanner
- Every call: Zod validation + 10s timeout + fallback to cache
- End prompts: "Reply ONLY valid JSON. No markdown, no explanation."
- Prompt templates with Zod schemas: .claude/prompts/ (clothing-analysis, outfit-generation, color-season, store-scanner)

## Browser automation
- Use Playwright MCP for all web interactions (GitHub, Railway, OAuth, API key dashboards)
- Google account is pre-authenticated in Playwright persistent profile
- Obtain API keys autonomously via Playwright: aistudio.google.com, console.cloudinary.com, openweathermap.org, console.cloud.google.com
- Fallback: read pre-filled keys from G:\Веб-додатки\api-keys.txt
- For library docs: use context7 MCP ("use context7" in prompts)

## Workflow
- Use frontend-design skill for all UI components and pages
- Use security-guidance skill for auth, payment, and data handling code
- For complex tasks: planning-with-files pattern (research.md → plan.md → implement → changes.md)
- For long autonomous builds: /ralph-loop:ralph-loop --max-iterations 20
- After major features: /revise-claude-md to capture learnings
- Run /interface-design:init at project start for design system
- Run /interface-design:audit after major UI changes
- After 2 failed attempts at same approach: /clear and try alternative

## Quality gates
- After code changes: typecheck + lint + relevant test
- Before commit: run verifier agent
- Before merge: /code-review:code-review
- After complex refactors: use code-reviewer agent for second opinion
