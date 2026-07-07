# Pocket Stylist — Complete AI Handoff Document

_Last verified against code: 2026-07-07. Compiled from live source at `G:\Веб-додатки\Stylist` (branch `main`, commit `056cdb3`)._

## 1. What the app does

**Pocket Stylist** is a personal AI wardrobe assistant delivered as an installable PWA (Progressive Web App). It solves one problem: given the clothes the user actually owns, plus real-time weather at their location and their personal color palette, suggest outfits they will actually want to wear today, this week, or for a specific occasion. It is **not** an e-commerce recommender — it never suggests items the user does not own. It is a **closet OS + AI outfit assembler**.

Core user journey:
1. User signs up (Google OAuth or email/password).
2. User photographs each item of clothing → uploaded to Cloudinary → Gemini classifies (category, color, fabric, formality, season, condition) → saved as `WardrobeItem` rows.
3. User optionally uploads a selfie → color-season analysis produces `colorSeason`, `colorPalette`, `avoidColors`.
4. User grants geolocation once or types their city → `lat/lon/city/timezone` saved on `User`.
5. User picks a stylist persona (classic / sassy / manly / kind) — this changes the tone of every message.
6. User taps "Suggest outfit" → server fetches real weather from Open-Meteo → rules-engine filters wardrobe → Gemini assembles 1–3 outfits from the filtered pool → returns JSON to client → client renders outfit cards with a speak button.
7. User rates outfit (like / another / I wore this) → feedback improves future suggestions and updates `timesWorn` / `lastWornAt`.
8. Weekly Lookbook: 7-day forward plan of outfits, one per day, respecting daily forecast.
9. Virtual try-on: user picks a garment + selfie → Fal.ai renders a photo of the garment on their body.
10. Store scanner: user photographs a garment in a store → verdict BUY / SKIP / CONSIDER with reasons based on their existing wardrobe.
11. Family mode: user creates a Family, adds members, marks selected items as `sharedWithFamily=true` → cross-member outfit suggestions can pull from the shared pool.

## 2. Tech stack (exact versions)

**Runtime**
- Node.js + Express 5 (`express ^5.2.1`)
- PostgreSQL via Prisma 7 (`@prisma/client ^7.8.0`, `pg ^8.20.0`) and `@prisma/adapter-pg`
- Zod 4 for schema validation (`zod ^4.3.6`)
- JWT auth via `jsonwebtoken ^9.0.3` (7-day tokens, refresh endpoint)
- Google Auth via `google-auth-library ^10.6.1`
- Gemini via `@google/generative-ai ^0.24.1` (model: `gemini-2.5-flash`)
- Cloudinary via `cloudinary ^2.9.0` (signed uploads, `destroy` on delete)
- Fal.ai via `@fal-ai/client ^1.10.1` (endpoint `fashn/tryon/v1.6`)
- Stripe via `stripe ^17.7.0`
- CORS via `cors ^2.8.6`

**Frontend**
- React 19 (`react ^19.2.0`, `react-dom ^19.2.0`)
- TypeScript strict
- Vite (`vite-plugin-pwa` with Workbox for offline caching)
- Tailwind CSS (utility classes only — no CSS-in-JS, no inline styles)
- React Router 7 (`react-router-dom ^7.18.1`)
- TanStack React Query 5 (`@tanstack/react-query ^5.90.21`) — data fetching + cache
- Lucide React (`lucide-react ^0.577.0`) — icons
- `heic2any ^0.0.4` — HEIC→JPEG conversion in the browser

**Testing / CI**
- `node --import tsx --test tests/*.test.ts` (Node built-in test runner; **not Vitest, not Jest**)
- 78 tests currently pass, 0 fail
- GitHub Actions: typecheck → lint → test → build
- ESLint + Prettier

**Deployment**
- GitHub repo: `https://github.com/sburmych-lgtm/pocket-stylist`
- Railway (auto-deploys on push to `main`)
- Live URL: `https://pocket-stylist-production.up.railway.app`
- Postgres add-on attached, `DATABASE_URL` via `${{Postgres.DATABASE_URL}}` reference
- Start command runs `npx prisma db push` at boot (auto-migrates schema)

## 3. Repository layout

```
G:\Веб-додатки\Stylist\
├── prisma/
│   └── schema.prisma          # Full DB schema (see §4)
├── server/                    # Express backend
│   ├── index.ts               # Express setup, CORS, security headers, JSON body limit 20MB
│   ├── api/                   # REST routes (13 routers)
│   │   ├── index.ts           # Mounts all routers under /api/*
│   │   ├── auth.ts            # Google OAuth + email/password + JWT refresh
│   │   ├── billing.ts         # Stripe: /me, /checkout, /portal, /webhook
│   │   ├── family.ts          # Family CRUD + shared wardrobe access
│   │   ├── feedback.ts        # Anonymous feedback widget
│   │   ├── import.ts          # Wardrobe CRUD + Google Drive import
│   │   ├── lookbook.ts        # 7-day outfit plan
│   │   ├── matching.ts        # Garment recreation from a reference photo
│   │   ├── profile.ts         # User profile, persona, location, color-analysis, account delete
│   │   ├── scanner.ts         # Store scanner BUY/SKIP verdict
│   │   ├── styling.ts         # Outfit generation, feedback, wear, tryon, weather
│   │   ├── tts.ts             # Text-to-speech via ElevenLabs
│   │   ├── analytics.ts       # User dashboard (worn counts, gap analysis)
│   ├── middleware/
│   │   ├── auth.ts            # requireAuth, optionalAuth, demo bypass (dev only)
│   │   ├── rate-limit.ts      # IP + per-user rate limits (bounded LRU + TTL)
│   │   └── require-access.ts  # Trial/paid gate — no-op when Stripe not configured
│   ├── services/
│   │   ├── app-status.ts      # /api/status flag builder
│   │   ├── cloudinary.ts      # uploadImage, deleteImage
│   │   ├── demo-store.ts      # In-memory demo user seed
│   │   ├── family.ts          # wardrobeVisibilityWhere, isFamilyMember, isFamilyAdmin
│   │   ├── gemini.ts          # Gemini client wrapper with timeout + Zod
│   │   ├── gemini-usage.ts    # Records GeminiUsage row per call
│   │   ├── oauth-state.ts     # HMAC-signed OAuth state with nonce + 10-min TTL
│   │   ├── subscription.ts    # Stripe skeleton + trial creation
│   │   ├── tts.ts             # ElevenLabs client + persona voice IDs + LRU cache
│   │   └── styling/
│   │       ├── outfit-generator.ts   # Gemini call + fallback rules-outfit + persona injection
│   │       ├── rules-engine.ts       # Pure code filters: temp, fabric, formality, colors
│   │       ├── weather.ts            # Open-Meteo forecast + geocoding
│   │       ├── personas.ts           # 4 persona prompt prefixes
│   │       └── tryon.ts              # Fal.ai virtual try-on
├── src/                       # React frontend
│   ├── App.tsx                # Router setup
│   ├── main.tsx               # Vite entry
│   ├── pages/                 # Route-level components
│   │   ├── HomePage.tsx       # Dashboard (LocationRequest, TrialBanner)
│   │   ├── LoginPage.tsx
│   │   ├── HowItWorksPage.tsx # Public landing (/how-it-works)
│   │   ├── WardrobePage.tsx   # Item grid + delete + edit
│   │   ├── StylingPage.tsx    # Outfit generation UI
│   │   ├── LookbookPage.tsx   # 7-day plan
│   │   ├── ScannerPage.tsx    # Store scanner
│   │   ├── MatchingPage.tsx   # Recreate an outfit from a reference photo
│   │   ├── ImportPage.tsx     # Bulk upload / Google Drive
│   │   ├── ProfilePage.tsx    # Settings, persona, color analysis, delete account
│   │   ├── FamilyPage.tsx     # Family management
│   │   ├── AnalyticsPage.tsx  # Cost-per-wear, gap analysis
│   │   ├── PrivacyPage.tsx / TermsPage.tsx
│   ├── components/
│   │   ├── Layout.tsx         # Navigation shell + OfflineBanner
│   │   ├── LocationRequest.tsx # Geolocation prompt or manual city input
│   │   ├── TrialBanner.tsx    # "N days left" banner
│   │   ├── PaywallModal.tsx   # Stripe checkout modal
│   │   ├── common/
│   │   │   ├── SpeakButton.tsx     # TTS trigger button
│   │   │   └── ErrorBoundary.tsx
│   │   ├── import/DropZone.tsx     # Multi-file uploader + HEIC convert
│   │   ├── import/DriveModal.tsx   # Google Drive fallback (no Picker API key needed)
│   │   ├── styling/
│   │   │   ├── OutfitCard.tsx
│   │   │   ├── PersonaSelector.tsx
│   │   │   ├── PersonaIntroBanner.tsx
│   │   │   ├── LookbookDayCard.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useGeolocation.ts       # Discriminated union: idle|requesting|granted|denied|unavailable|error
│   │   ├── useSubscription.ts      # Polls /api/billing/me
│   │   ├── useTTS.ts               # ElevenLabs or browser SpeechSynthesis fallback
│   ├── services/api.ts        # All client API wrappers + 402 interceptor → paywall event
│   ├── contexts/AuthContext.tsx
│   ├── i18n/                  # uk.ts (default), en.ts (both exactly 780 lines, keys aligned)
│   └── shared/pwa-navigation.ts  # API_NAVIGATION_DENYLIST for service worker
├── public/
│   ├── manifest.json
│   ├── icons/icon-192.png, icon-512.png, icon-512-maskable.png
│   └── favicon.svg
├── tests/                     # 78 tests (Node built-in test runner)
├── .claude/                   # Skills/rules/prompts for Claude Code (agent config)
│   ├── prompts/               # Gemini prompt templates + Zod schemas
│   │   ├── clothing-analysis.md
│   │   ├── outfit-generation.md
│   │   ├── color-season.md
│   │   └── store-scanner.md
│   └── rules/                 # typescript-react.md, gemini-api.md, safety.md
├── STRIPE_SETUP.md            # How the owner activates Stripe
├── TTS_SETUP.md               # How the owner activates ElevenLabs
├── CLAUDE.md                  # Codebase intro for Claude Code
├── package.json
└── vite.config.ts             # PWA plugin config, workbox rules
```

## 4. Data model (Prisma)

Models (all `snake_case` in DB via `@@map`, `camelCase` in code):

- **User**: `id`, `email` (unique), `passwordHash?`, `googleId?` (unique), `name?`, `avatarUrl?`, `googleAccessToken?`, `googleRefreshToken?`, `googleDriveGrantedAt?`, `colorSeason?`, `colorPalette?` (JSON), `avoidColors?` (JSON), `genderMode` (default `"neutral"`), `lat?`, `lon?`, `city?`, `timezone?`, `stylistPersona` (default `"classic"`), `termsAcceptedAt?`, `createdAt`, `updatedAt`. Relations: `wardrobeItems`, `outfits`, `outfitLogs`, `families` (via `FamilyMember`), `subscription?`, `feedback`, `outfitRenders`.

- **Subscription**: `id`, `userId` (unique), `status` (`trialing` | `active` | `past_due` | `canceled` | `none`), `trialEndsAt?`, `currentPeriodEnd?`, `stripeCustomerId?`, `stripeSubscriptionId?`, `stripePriceId?`, `cancelAtPeriodEnd`, cascade delete with User. Index on `status`.

- **WardrobeItem**: `id`, `userId`, `imageUrl`, `thumbnailUrl?`, `category` (enum-like string), `subcategory?`, `colorPrimary`, `colorHex?`, `pattern` (default `"solid"`), `fabric?`, `formalityLevel` (Int, default 3), `season` (default `"all"`), `brand?`, `price?`, `condition` (default `"good"` — values: `new`|`good`|`worn`), `confidence` (Float, default 0), `timesWorn` (Int, default 0), `lastWornAt?`, `purchasedAt?`, `tags?` (JSON with `analysisReliable`, `needsReview`), `sharedWithFamily` (default `false`), cascade with User. Indexes on `userId`, `category`, `userId+category`, `userId+createdAt`, `userId+sharedWithFamily`.

- **Outfit**: `id`, `userId`, `name`, `stylingTip?`, `confidence`, `liked?` (Boolean), `contextHash?`, `createdAt`. Relations: `items` (via `OutfitItem`), `logs`. Indexes on `userId`, `contextHash`.

- **OutfitItem**: join table `outfitId` × `wardrobeItemId` (unique together).

- **OutfitLog**: `id`, `userId`, `outfitId`, `wornAt`. Index on `userId+wornAt`.

- **Family**: `id`, `name`, `createdAt`, `members`. Cascade deletes when family removed.

- **FamilyMember**: `id`, `familyId`, `userId`, `role` (default `"member"`, values include `"owner"`, `"admin"`), unique together `familyId+userId`. Index on `userId`.

- **OutfitRender**: Fal.ai try-on results — `userId`, `modelImageUrl`, `garmentImageUrl`, `resultImageUrl`, `durationMs`, `createdAt`. Index on `userId+createdAt`. Cascade with User.

- **Feedback**: `id`, `userId?` (SetNull on user delete — anonymous feedback survives), `email?`, `message`, `userAgent?`, `source?`, `createdAt`. Indexes on `createdAt`, `userId`.

- **GeminiUsage**: `id`, `date` (Date only), `requestType`, `tokenCount`, `count`. Unique together `date+requestType` — used for daily quota tracking (Gemini free tier is 1500 req/day).

## 5. HTTP API surface

All routes are mounted under `/api/*` (see `server/api/index.ts`). Auth strategy:

- **Public** (no auth): `/api/auth/*`, `/api/feedback`, `/api/status`.
- **Auth required** (JWT in `Authorization: Bearer <token>`): everything else.
- **Trial/paid gated** (via `requirePaidOrTrial` — no-op when `STRIPE_ENABLED=false`): `/api/tts`, `/api/styling`, `/api/scanner`, `/api/matching`, `/api/lookbook`. Returns `402` when trial expired and Stripe is fully configured.

### Auth (`/api/auth`)
- `POST /google` — verify Google ID token, upsert user, issue JWT (requires GDPR terms on new user).
- `GET /google/redirect` — build signed OAuth state, redirect to Google.
- `POST /google/drive-consent` — request Drive access (secure POST, not GET-with-token).
- `GET /google/callback` — verify signed state + exchange code, HTML redirect (not 302 — bypasses service worker).
- `POST /demo` — dev-only demo login (disabled in production when `GOOGLE_CLIENT_ID` is set).
- `GET /me` — returns current user (includes `lat/lon/city/timezone/stylistPersona`).
- `GET /google-access-token` — returns fresh access token (refreshes if expired).
- `POST /email/register` — Zod-validated body, scrypt password hash, GDPR terms required.
- `POST /email/login` — rate limited (`authLimiter`).
- `POST /refresh` — rotate JWT (7-day validity).
- `POST /logout` — clear cookie.

### Billing (`/api/billing`)
- `GET /me` — returns effective subscription: `{ status, trialEndsAt, daysLeft, isPaid, hasAccess, stripeConfigured }`. When Stripe disabled: always `hasAccess:true` and `daysLeft:Infinity`.
- `POST /checkout` — creates Stripe Checkout, returns URL. 503 if Stripe disabled.
- `POST /portal` — Stripe Billing Portal.
- `POST /webhook` — Stripe webhook (uses `express.raw` for signature verification).

### Wardrobe / Import (`/api/import`)
- `POST /ingest` — direct-ingestion flow: image → Cloudinary → Gemini → auto-save. Paid+geminiLimiter.
- `POST /analyze` — analyze image without saving (for preview).
- `POST /save` — save item after review.
- `GET /wardrobe` — list all user items.
- `PATCH /wardrobe/:itemId` — edit category, subcategory, colors, price, etc. **and** `sharedWithFamily` toggle.
- `DELETE /wardrobe/:itemId` — deletes DB row AND `deleteImage()` on Cloudinary.
- `GET /drive/list` — list user's Drive files (uses stored `googleAccessToken` / refresh).
- `POST /drive-download` — download from Drive (20MB cap).

### Styling (`/api/styling`)
- `POST /suggest` OR `/generate` — same handler, both paths accepted. Body: `{ occasion?, mood?, targetUserId?, requestedLat?, requestedLon? }`. Returns outfits array or `{ messageCode: 'empty_wardrobe' | 'wardrobe_too_small' | 'location_required', message }`. **This is the Smart Stylist.**
- `POST /feedback` — `{ outfitId, liked: boolean, source? }`.
- `POST /wear` — mark outfit worn: creates `OutfitLog`, increments `timesWorn`, updates `lastWornAt` on each item.
- `GET /weather` — quick weather-only query for UI display.
- `POST /tryon` — Fal.ai virtual try-on. Rate limit 10/24h. Real `AbortController` + 60s timeout. Errors return `tryon_not_configured` (503), `tryon_timeout` (504), `tryon_failed` (502).

### Lookbook (`/api/lookbook`)
- `POST /generate` — 7-day plan (day 1 uses Gemini, days 2–7 use rules only for cost).
- `GET /current` — return most recent plan.
- `POST /:dayIndex/wear` — mark specific day worn.
- `POST /regenerate-day` — regenerate a single day.

### Scanner (`/api/scanner`)
- `POST /analyze` — photo of an in-store garment → BUY / SKIP / CONSIDER verdict with reasons (fillsGap, createsOutfits, hasDuplicates, avoidMatch, paletteMatch). Falls back to fallback verdict when Gemini fails.

### Matching (`/api/matching`)
- `POST /analyze` — takes a reference photo, returns garment breakdown + recreation suggestions from user's wardrobe.

### Profile (`/api/profile`)
- `GET /` — full user profile.
- `PATCH /` — update name, genderMode, avoidColors etc.
- `PATCH /persona` — change `stylistPersona`.
- `GET /location`, `PATCH /location` — accepts either `{ lat, lon, city?, timezone? }` OR `{ city }` (triggers server-side geocoding via Open-Meteo).
- `POST /color-analysis` — selfie → color season + palette (Gemini + Zod).
- `DELETE /account` — full delete: `$transaction` with family cascade + `Promise.allSettled` deletes each Cloudinary asset.

### Family (`/api/family`)
- `GET /` — list families user belongs to.
- `POST /` — create family (creator becomes owner).
- `PATCH /:familyId` — rename.
- `DELETE /:familyId` — owner-only.
- `POST /:familyId/members` — invite/add member.
- `DELETE /:familyId/members/:memberId` — owner-cannot-self-remove guard. Admins cannot remove owner. Non-owner members can self-remove.
- `GET /:familyId/members/:memberId/wardrobe` — IDOR-protected: both caller and target must be in same family. Returns only `sharedWithFamily=true` items.

### Feedback (`/api/feedback`)
- `POST /` — anonymous or authenticated.

### TTS (`/api/tts`)
- `GET /status` — `{ elevenlabsEnabled, voices }`.
- `POST /` — `{ text, persona? }`. 800-char cap. Rate limit 15 per 5 min per user. Returns `audio/mpeg` blob (or Cloudinary URL if cached). 503 with `useBrowserFallback:true` when disabled.

### Status (`/api/status`)
Public. Returns feature-flag summary:
```json
{
  "geminiConfigured": true,
  "cloudinaryConfigured": true,
  "googleAuthConfigured": true,
  "googleSignInConfigured": true,
  "googleRedirectConfigured": true,
  "googleDriveConfigured": true,
  "googleDrivePickerConfigured": false,
  "emailAuthEnabled": true,
  "tryOnConfigured": true,
  "googleClientId": "...",
  "googlePickerApiKey": null,
  "ttsConfigured": false,
  "stripeConfigured": false
}
```

## 6. Frontend routes (React Router 7)

Public: `/`, `/how-it-works`, `/login`, `/privacy`, `/terms`, `/install` (if present).
Authenticated: `/home`, `/wardrobe`, `/import`, `/styling`, `/lookbook`, `/scanner`, `/matching`, `/profile`, `/family`, `/analytics`.

`Layout.tsx` wraps authenticated routes: top nav (desktop) + bottom tab bar (mobile) + `OfflineBanner` + `TrialBanner` + `PaywallModal` mounted globally.

## 7. Environment variables

Required in production:
- `DATABASE_URL` — Postgres connection string (Railway reference `${{Postgres.DATABASE_URL}}`).
- `APP_URL` — `https://pocket-stylist-production.up.railway.app`.
- `NODE_ENV=production`.
- `SESSION_SECRET` — 64-byte hex.
- `JWT_SECRET` — 64-byte hex.
- `GEMINI_API_KEY` — Google AI Studio key.
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — OAuth Web application.
- `GOOGLE_REDIRECT_URI` — `https://pocket-stylist-production.up.railway.app/api/auth/google/callback`.
- `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`.
- `FAL_KEY` — Fal.ai for try-on.

Optional (features gracefully degrade):
- `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` + `STRIPE_WEBHOOK_SECRET` — Stripe billing (without these, all users have permanent free access).
- `ELEVENLABS_API_KEY` (+ optional `ELEVENLABS_VOICE_CLASSIC` / `_SASSY` / `_MANLY` / `_KIND`) — premium TTS. Without: browser SpeechSynthesis fallback used.
- `GOOGLE_PICKER_API_KEY` — Drive Picker (without: DriveModal fallback used).

**Never** stored anywhere except env vars: no keys in code, no keys in `.env.example` (uses `YOUR_KEY_HERE` placeholders). `.env` is in `.gitignore`. Railway variables must be added via **"+ New Variable"**, **not Raw Editor** — the Raw Editor has wiped existing variables in the past.

## 8. The Smart Stylist — how it works end-to-end

This is the heart of the app. Flow from `POST /api/styling/suggest` to response:

1. **Load user context** (`styling.ts:105-145`): fetch `User` fields — `lat`, `lon`, `city`, `timezone`, `colorSeason`, `colorPalette`, `avoidColors`, `genderMode`, `stylistPersona`.
2. **Resolve weather**: if request has `requestedLat/Lon`, use those; else use user's saved coords; else return `{ messageCode: 'location_required' }` (no geoIP guessing). Weather via Open-Meteo (`server/services/styling/weather.ts:fetchWeather`), keyed cache `${lat.toFixed(4)},${lon.toFixed(4)},${timezone}` for 30 min. On HTTP fail or missing coords → mock weather with `source:'mock'` flag. Zod-validates response with `superRefine` array-length check.
3. **Load wardrobe**: `wardrobeVisibilityWhere(userId, targetUserId)` — for own wardrobe returns `{ userId }`, for family member returns `{ userId: targetUserId, sharedWithFamily: true }`. **All items**, no pagination.
4. **Filter with rules-engine** (`rules-engine.ts:filterWardrobe`):
   - Season gate (winter items blocked in summer, etc.)
   - Temperature gate (light fabrics blocked below 15°C, heavy wool blocked above 22°C)
   - Precipitation gate (sandals blocked in rain)
   - `condition==='worn'` items excluded
   - `avoidColors` items excluded
   - Formality gate (occasion-appropriate)
5. **Handle degenerate cases**:
   - Wardrobe empty → `{ messageCode: 'empty_wardrobe' }` with CTA.
   - Fewer than 3 items after filtering → `{ messageCode: 'wardrobe_too_small' }`.
6. **Apply persona prefix** (`personas.ts:applyPersona`): inject persona system prompt BEFORE the base prompt, so the final "Reply ONLY valid JSON" instruction is always the last line.
7. **Call Gemini** (`outfit-generator.ts:generateOutfits`): pass full **filtered pool** with categories, colors, patterns, fabrics, seasons, formality, condition, timesWorn, lastWornAt. Response schema Zod-validated. 10s timeout. On failure → fallback rules-based outfit (`fallbackOutfit`) with UA-lang note "AI тимчасово недоступний".
8. **Post-validate Gemini output** (`mapIndexesToItems`): Gemini returns item indexes into the pool; server maps them back to real `WardrobeItem` IDs, filters out invented items, deduplicates outfits by sorted-id-hash, ensures completeness (`isCompleteOutfit`: needs dress OR top+bottom; requires outerwear when `temp<=14` OR season is winter/fall).
9. **Log usage**: `recordGeminiUsage("outfit-generation")` upserts `GeminiUsage` row.
10. **Return**: `{ outfits: [...], weather: {...}, source: 'ai' | 'rules-fallback' }`.

**Rules-engine helpers**:
- `colorsHarmonize(a, b)` — color family logic (blue+white=ok, red+pink=ok, red+orange=clash).
- `hasCompatibleColors(items)` — checks all pairs in a candidate outfit.
- `weatherToSeason(tempC)` — season inference for filtering.

**Persona system**:
- 4 personas defined in `personas.ts`: `classic` (neutral professional), `sassy` (Anthony Marangello from SATC vibe, UA slang), `manly` (gruff dude), `kind` (warm mother).
- Each has `systemPrompt` (1 paragraph character), `styleNote` (tone directive for `stylingTip`), `sampleQuote` (UI preview).
- `applyPersona(basePrompt, persona)` prepends system prompt; **base prompt's JSON-only instruction stays last** (crucial for Gemini output validity).
- `normalizePersona(value)` defaults to `'classic'` on invalid input.
- Personas apply to BOTH AI response tips AND the rules-fallback (`generateTip()` uses persona for fallback text too).

## 9. Auth flow

**Google OAuth**:
- Signed state: HMAC-SHA256(nonce + issuedAt + flowType) with `SESSION_SECRET`. Verified with `timingSafeEqual` + 10-min TTL check. Nonce also in httpOnly cookie for double-check.
- `safeReturnTo(returnTo)` validates redirect path: must start with `/`, must NOT start with `//` or contain `\`. Defaults to `/import`.
- Callback returns **HTML with `<meta refresh>` + `window.location.replace()`** instead of HTTP 302 — this is the fix for the service worker intercepting OAuth navigation.
- On first Google signup, `termsAcceptedAt` must be sent — else `TermsNotAcceptedError` thrown.

**Email/password**:
- `scrypt` hash (Node built-in, no bcrypt dep needed).
- Rate limited by `authLimiter` (per-IP).

**JWT**:
- 7-day validity. Stored in httpOnly cookie + accessible via `Authorization: Bearer` header.
- `POST /api/auth/refresh` rotates without re-login.

**Client**: `AuthContext.tsx` wraps app, `useAuth()` hook exposes `{ user, login, logout }`. `services/api.ts` has a global fetch wrapper that:
- Adds `Authorization` header.
- Intercepts 402 responses → dispatches `paywall:open` event (PaywallModal listens).
- Intercepts 401 → clears context, redirects to `/login`.

## 10. Subscription / paywall system

**Design principle**: Stripe is optional. Without keys, the app is fully open — no user is ever locked out.

- On every new signup (Google OR email), `createTrialSubscription(userId)` runs in try/catch (never blocks signup). Uses `prisma.subscription.upsert()` for idempotency.
- `getEffectiveSubscription(userId)` returns `{ status, trialEndsAt, daysLeft, isPaid, hasAccess, stripeConfigured }`.
  - When `STRIPE_ENABLED=false` (any of 3 vars missing): always `hasAccess:true, daysLeft:Infinity`.
  - When enabled: `hasAccess=true` if `status ∈ {trialing (not expired), active}`.
- Middleware `requirePaidOrTrial` short-circuits to `next()` when disabled; returns `402 { error: 'subscription_required', trialEnded: true }` when expired+enabled.
- Applied to: `/api/tts`, `/api/styling`, `/api/scanner`, `/api/matching`, `/api/lookbook`.
- Client `TrialBanner` shows when `daysLeft <= 3`. Client `PaywallModal` opens on 402 event OR banner CTA click. If `!stripeConfigured`, modal shows "Поки безкоштовно — оплата буде додана пізніше" instead of crashing.
- `PaywallModal.tsx` price display via `import.meta.env.VITE_STRIPE_PRICE_DISPLAY` (default "€4.99/міс").

## 11. TTS (voice) system

Two-tier design.

**Server** (`server/services/tts.ts`):
- `TTS_ELEVENLABS_ENABLED = !!process.env.ELEVENLABS_API_KEY`.
- `PERSONA_VOICE_IDS` per-persona, overridable via env `ELEVENLABS_VOICE_CLASSIC/SASSY/MANLY/KIND`. Defaults are English voices that handle Ukrainian OK with the `eleven_multilingual_v2` model.
- `synthesizeSpeech({ text, persona })` → POST to ElevenLabs, returns MP3 buffer.
- SHA-256 cache of `${text}|${persona}` → Cloudinary raw resource if available, else in-memory LRU (max 100).
- `POST /api/tts` cap: 800 chars, rate limit 15/5 min per user. Returns `audio/mpeg` stream (or Cloudinary URL). 503 `{ useBrowserFallback:true }` when disabled.

**Client** (`src/hooks/useTTS.ts`):
- On first speak, fetches `/api/tts/status`.
- If `elevenlabsEnabled`: POST + play Blob via `<audio>`, revoke ObjectURL on cleanup, cache last 5 blobs.
- Else: `speechSynthesis.speak(new SpeechSynthesisUtterance(...))` with `lang='uk-UA'`, prefers Ukrainian voice from `getVoices()`.
- Per-persona prosody in browser mode: `classic 1.0/1.0`, `sassy 1.3/1.1`, `manly 0.7/0.9`, `kind 1.1/0.85` (pitch/rate).
- Cancels previous utterance before starting new (`synth.cancel()`).
- Hidden entirely if neither backend nor `speechSynthesis` available.

**Client** (`src/components/common/SpeakButton.tsx`): Volume2 icon → click to speak, Square icon while playing. Mounted on `OutfitCard` and `LookbookDayCard`.

## 12. Family / shared wardrobe

Design: pull-based sharing. A user marks specific items with `sharedWithFamily=true`; other family members can see ONLY those items.

- `wardrobeVisibilityWhere(userId, targetUserId?)` — if own wardrobe: `{ userId }`; if family member's: `{ userId: targetUserId, sharedWithFamily: true }`.
- Used identically in styling, lookbook, scanner, family GET-wardrobe endpoint (single point of truth).
- IDOR closed: `GET /family/:familyId/members/:memberId/wardrobe` verifies **both caller and target** are in the same family (not just one). Comment in `family.ts:257-261` documents the prior vulnerability.
- Cross-member outfit suggestions: if `targetUserId !== userId`, generated outfit **not saved as own** (`styling.ts:247`).
- Roles: `owner`, `admin`, `member`. Owner-only can delete family. Admins cannot remove owner. Non-owner members can self-remove. Owner cannot self-remove (`family.ts:230-233`).

## 13. Try-on

- `POST /api/styling/tryon` body: `{ selfieUrl, garmentUrl }`.
- `tryon.ts:63-64` creates `new AbortController()` + `setTimeout(...abort, TRYON_TIMEOUT_MS)`.
- Calls `fal.subscribe('fashn/tryon/v1.6', { input, signal })`.
- On abort → `throw new Error('tryon_timeout')` → API maps to 504.
- On other error → 502 `tryon_failed`.
- Saves `OutfitRender` row with `durationMs`.
- Rate limited (`falLimiter`: 10/24h per user).
- Client `useTryOn` hook manages Blob URL lifecycle (`URL.createObjectURL` + `URL.revokeObjectURL`).

## 14. Store scanner

- `POST /api/scanner/analyze` body: `{ imageUrl }` (already uploaded to Cloudinary).
- Loads user's wardrobe + `colorSeason` + `colorPalette` + `avoidColors` for context.
- Gemini classifies the new garment.
- Verdict engine builds reasons:
  - `fillsGap` — user has few of this category.
  - `createsOutfits` — item pairs well with existing.
  - `hasDuplicates` — user already owns similar.
  - `hasManySimilar` — 3+ similar already.
  - `avoidMatch` — matches user's `avoidColors`.
  - `paletteMatch` — matches user's palette.
- Final verdict: `BUY` / `SKIP` / `CONSIDER` (downgraded to CONSIDER if `!analysisReliable`).
- Gemini timeout / fail → falls back to reasonable default verdict, does not error.

## 15. Coding conventions (see `.claude/rules/`)

- TypeScript strict. Never `any` — use `unknown` and narrow with type guards.
- `interface` for object shapes, `type` for unions/intersections.
- Zod-validate ALL external data: API request bodies, Gemini output, user input.
- React: one component per file, default export, functional only.
- Custom hooks in `src/hooks/`.
- Tailwind utility classes only — no CSS-in-JS, no inline styles.
- Discriminated unions for async state: `{ status: 'idle' } | { status: 'loading' } | { status: 'error'; error: Error } | { status: 'success'; data: T }`.
- `const` assertions and `satisfies` where useful.
- `React.lazy()` + `Suspense` for route-level code splitting.
- All images: `alt` text + `loading="lazy"` below fold.
- Error boundaries around: Gemini-dependent components, camera/scanner, image upload.
- Prompts to Gemini always end with: `Reply ONLY valid JSON. No markdown, no explanation.`
- Every Gemini call: 10s timeout + Zod validation + fallback to cache OR rules result.
- File naming: PascalCase for components, kebab-case for services.

## 16. Security posture

- CSP, HSTS (production only), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy (`server/index.ts:16-30`).
- CORS: allowlist = `APP_URL` + `RAILWAY_PUBLIC_DOMAIN` + `pocket-stylist-production.up.railway.app`. Localhost allowed only when `!isProd`.
- Rate limit storage: bounded LRU (`MAX_BUCKETS=10000`) + per-bucket TTL (`rate-limit.ts:21-49`).
- IP detection: last hop of `x-forwarded-for` (Railway = 1 hop).
- Body limit: 20MB JSON (`express.json({ limit: '20mb' })`). Stripe webhook uses `express.raw` for signature verify.
- Third-party errors NEVER leaked to client — always mapped to safe enum codes.
- User photo URLs never logged.
- `npm audit`: 0 vulnerabilities.
- Prisma CLI kept in `dependencies` (not `devDependencies`) so Railway `npx prisma db push` works at startup.

## 17. Testing

- Node built-in test runner (`node --import tsx --test tests/*.test.ts`).
- 78 tests: security (auth, family privacy, HTTP), OAuth (Google, Picker), PWA navigation denylist, weather, styling with all personas, TTS, rate limits, subscription state machine, personas prompt integrity.
- CI: `.github/workflows/ci.yml` — quality (typecheck → lint → test) + build.
- Test glob `tests/*.test.ts` is POSIX-portable.
- No mocks of Prisma — tests hit an in-memory or ephemeral instance.
- External services (Gemini, Fal.ai, Open-Meteo, ElevenLabs, Stripe) mocked via `globalThis.fetch` patching.

## 18. Deployment

- Push to `main` → Railway auto-deploy.
- Build: `prisma generate && tsc -p tsconfig.server.json && vite build`.
- Start: `NODE_ENV=production sh -c 'npx prisma db push && exec node dist/server/server/index.js'` (auto-migrates schema at boot).
- Static frontend served by Express from `dist/client/`.
- Postgres add-on attached, connection via `${{Postgres.DATABASE_URL}}` reference variable.
- Live URL: `https://pocket-stylist-production.up.railway.app`.
- `/api/status` is a public smoke-test endpoint returning all feature flags.

## 19. Known limitations / follow-ups

- StylingPage lacks `ErrorBoundary` wrapper — Gemini crash could white-screen (P2, easy fix).
- Lookbook days 2–7 use rules only (cost optimization); may feel formulaic — worth A/B testing after 100+ users.
- Browser TTS `prosody` per persona is speculative; hard-coded values (pitch 0.7 for manly, 1.3 for sassy) not user-validated.
- No Google Picker key set in production — DriveModal fallback works but Picker UX is nicer.
- `weatherConfigured` flag has been removed from `/api/status` (Open-Meteo needs no key).
- Persona onboarding banner uses localStorage flag `persona_intro_seen` — resets on cleared storage.
- No native push notifications (PWA on iOS does not support them).

## 20. Latest git history (main branch)

```
056cdb3 fix(deps): keep prisma available at runtime
084b1ff fix(deps): patch audited vulnerabilities
98f27d5 fix(pwa): bypass service worker for API navigation
890d6f6 fix(ci): make test glob portable
d69c176 fix(app): harden optional services and offline UX
fa2423b fix(styling): make wardrobe recommendations resilient
b2d0f7d fix(security): harden auth and family data boundaries
3135d80 feat(core): geolocation+Open-Meteo, stylist personas, Stripe paywall, voice TTS
8ec7f93 fix(wardrobe): move delete button to left-top, red and larger per user feedback
d1e91be feat(wardrobe): mobile-friendly delete button + confirm modal
```

## 21. Quick-start commands (for any future AI or dev)

```bash
cd "G:\Веб-додатки\Stylist"
npm install                # first time
npm run dev                # start both frontend (Vite) and backend (tsx watch)
npm test                   # run 78 tests
npm run typecheck          # strict TS check
npm run lint               # ESLint
npm run build              # production build
git status && git log --oneline -10   # see current state
curl https://pocket-stylist-production.up.railway.app/api/status  # live smoke test
```

## 22. Files to read FIRST when picking up this project

1. `CLAUDE.md` — project intro.
2. `prisma/schema.prisma` — data model.
3. `server/api/index.ts` — route inventory.
4. `server/services/styling/outfit-generator.ts` + `rules-engine.ts` + `personas.ts` — heart of the AI.
5. `src/pages/StylingPage.tsx` + `src/pages/LookbookPage.tsx` — main user flows.
6. `.claude/prompts/outfit-generation.md` — Gemini prompt template.
7. `STRIPE_SETUP.md` + `TTS_SETUP.md` — activation guides.

---
_End of handoff document._
