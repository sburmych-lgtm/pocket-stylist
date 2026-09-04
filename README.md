# Pocket Stylist

A personal AI wardrobe assistant delivered as an installable PWA. Given the clothes the user
actually owns, plus real-time weather and their personal color palette, it suggests outfits they
will actually want to wear — a closet OS + AI outfit assembler, not an e-commerce recommender.

## How it works

1. Sign up (Google OAuth or email/password).
2. Photograph each clothing item → uploaded to Cloudinary → classified by Gemini (category,
   color, fabric, formality, season, condition) → saved as wardrobe items.
3. Optionally upload a selfie → color-season analysis produces a personal color palette.
4. Grant geolocation (or type a city).
5. Pick a stylist persona (classic / sassy / manly / kind) — sets the tone of every message.
6. Tap "Suggest outfit" → server fetches weather from Open-Meteo → rules-engine filters the
   wardrobe → Gemini assembles outfits from the filtered pool.

## Stack

- Vite + React (client), Express + `tsx` (server)
- PostgreSQL via Prisma (`@prisma/client`, `@prisma/adapter-pg`)
- Cloudinary (image storage), Google Gemini (`@google/genai`), fal.ai client
- PWA, HEIC image conversion (`heic2any`)

## Running locally

```bash
npm install
npm run dev          # client (Vite) + server (tsx watch) concurrently
```

Other scripts: `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run db:migrate` / `db:push` / `db:studio` (Prisma). Requires a `.env` — see `.env.example`
for required variables; never commit a real `.env`.

## Where the docs live

- `AI_HANDOFF.md` — full technical handoff (architecture, data model, user journey)
- `HANDOFF.md`, `STARTUP_PROMPT.md` — session/agent handoff notes
- `ROADMAP.md` — planned work
- `ERRORS.md` — known issues log
- `MY_STRATEGY.md` — product strategy notes
- `PRIVACY.md`, `TERMS.md` — legal pages served by the app
- `STRIPE_SETUP.md`, `TTS_SETUP.md` — third-party integration setup notes
- `CLAUDE.md` — agent instructions for this repository

