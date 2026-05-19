# Pocket Stylist — handoff after direct-ingest refactor

**Date:** 2026-05-19
**Commit:** `79f0c9b` (live on Railway)
**Live URL:** https://pocket-stylist-production.up.railway.app
**Repo:** https://github.com/sburmych-lgtm/pocket-stylist

---

## What this release ships

### 1. Categories — 14 isolated sections, single source of truth

`src/shared/wardrobe-categories.ts` is now the only place that lists clothing
sections. Both client (WardrobePage, ItemCard dropdown, ImportPage status
chips) and server (Gemini prompt, Zod validators, demo store) import from it.

The 14 sections, with their UA labels:

| key | UA | EN |
|---|---|---|
| `tops` | Верх | Tops |
| `bottoms` | Низ | Bottoms |
| `jeans` | Джинси | Jeans |
| `pants` | Штани | Pants |
| `skirts` | Спідниці | Skirts |
| `dresses` | Сукні | Dresses |
| `outerwear` | Верхній одяг | Outerwear |
| `footwear` | Взуття | Footwear |
| `swimwear` | Купальники | Swimwear |
| `pajamas` | Піжама | Pajamas |
| `underwear` | Білизна | Underwear |
| `accessories` | Аксесуари / Прикраси | Accessories / Jewelry |
| `sportswear` | Спортивний одяг | Sportswear |
| `suits` | Костюми | Suits |

Legacy values still in the DB (`shoes`, `activewear`, `sleepwear`, `lingerie`,
`jewelry`) are folded into the new canonical names by `normalizeCategory()`
at every boundary — no destructive migration required.

The Gemini prompt was rewritten with explicit routing rules so jeans land in
`jeans`, sneakers in `footwear`, etc., instead of all collapsing into
`bottoms`/`tops`.

### 2. Direct ingestion — staged review removed

Old flow: drop → upload → analyze → "Save to wardrobe" CTA → commit.
New flow: drop → upload → analyze → **already in wardrobe**. No CTA.

If Gemini mis-categorizes, the user re-categorizes inline on the wardrobe
card (pencil icon → dropdown → check). Edit endpoint is `PATCH
/api/import/wardrobe/:itemId` (strict Zod, normalizes aliases, demo store
mirrored).

The old `POST /api/import/analyze` is kept as a deprecated shim with
`Deprecation: true` and `Link: </api/import/ingest>; rel="successor-version"`
headers so any in-flight old client code still works.

### 3. HEIC + upload pipeline

- `heic2any` is in `dependencies` and lazy-loaded only when an actual
  `.heic/.heif` file appears.
- `compressImageToBase64` automatically routes HEIC through
  `ensureBrowserReadable` first.
- DropZone accepts `image/*,.heic,.heif` on both file-input click and
  drag-drop, with explicit suffix filter (Safari iOS handles HEIC natively,
  desktop Chrome does not — we cover both).
- Per-file timing logs are gated behind `localStorage.DEBUG_UPLOAD=1`.
- Hard-to-fix HEIC edge cases (>25 MB RAW exports, multi-frame Live Photos,
  animated HEIF) are documented in [ERRORS.md](ERRORS.md) with user
  workarounds.

### 4. Drive error boundary + log tags

`<ErrorBoundary scope="drive-modal">` wraps DriveModal in DropZone. On any
unhandled exception in the picker / modal, the user sees a dismissable
Ukrainian toast (`import.drive.crashTitle`) instead of a route crash.

Server logs all Drive errors with `[DRIVE]` prefix so Railway log search
works (`[DRIVE] list error`, `[DRIVE] download error`).

### 5. Feedback widget

Floating `MessageCircle` button bottom-right of every authed page. Click →
modal with optional email + 2000-char textarea → `POST /api/feedback` →
toast "Дякуємо!".

Server uses `optionalAuth` (anonymous OK), persists to new `Feedback` table
(`id`, `userId?`, `email?`, `message`, `userAgent?`, `source?`, `createdAt`).
Demo users go through anonymously so the flow is provable without polluting
real users.

### 6. Hardening (carried over from prior pass)

- Email auth: scrypt hash, withTimeout 5 s, length caps (email 254, password
  200, name 100).
- JSON-only error middleware — body-parser errors return JSON not HTML.
- `app.disable("x-powered-by")`, `Cache-Control: no-store` on `/api/status`.
- Express start script applies Prisma schema on boot
  (`prisma db push --accept-data-loss`).

---

## Endpoint status (post-deploy, live)

| Route | Method | Auth | Status | p50 | Notes |
|---|---|---|---|---|---|
| `/api/status` | GET | none | 200 | ~0.3 s | New flag: `googleDriveConfigured` |
| `/api/auth/email/register` | POST | none | 200/400/409 | ~0.4 s | Returns `{token, user}` |
| `/api/auth/email/login` | POST | none | 200/401 | ~0.35 s | scrypt verify |
| `/api/auth/demo` | POST | none | 200 | ~0.3 s | DB upsert + in-memory fallback |
| `/api/auth/me` | GET | bearer | 200/401 | ~0.3 s | |
| `/api/auth/google/redirect` | GET | none | 302 | ~0.3 s | scope=openid+email+profile **only** |
| `/api/auth/google/drive-consent` | GET | optional | 302 | ~0.3 s | scope += drive.file, state=drive:/import (single-encoded) |
| `/api/auth/google/callback` | GET | none | 200 (HTML redirect) | ~0.4 s | Branches on state |
| `/api/auth/google-access-token` | GET | bearer | 200/401 | ~0.3 s | |
| `/api/auth/logout` | POST | none | 200 | ~0.1 s | Stateless |
| `/api/import/ingest` | POST | bearer | 200/400/401 | 4–6 s | upload + Gemini + DB in one shot |
| `/api/import/analyze` | POST | bearer | 200 | 4–6 s | DEPRECATED — emits Deprecation/Link headers |
| `/api/import/save` | POST | bearer | 200 | 0.5 s | DEPRECATED — kept for old clients |
| `/api/import/wardrobe` | GET | bearer | 200 | ~0.3 s | Categories normalized on read |
| `/api/import/wardrobe/:id` | PATCH | bearer | 200/400/404 | ~0.4 s | NEW: per-item edit |
| `/api/import/wardrobe/:id` | DELETE | bearer | 200/404 | ~0.3 s | |
| `/api/import/drive/list` | GET | bearer | 200/401/502 | varies | `[DRIVE]` tagged errors |
| `/api/import/drive-download` | POST | bearer | 200/401/502 | varies | `[DRIVE]` tagged errors |
| `/api/feedback` | POST | optional | 200/400 | ~0.4 s | NEW: anonymous OK |

All other domain routers (`/styling`, `/scanner`, `/matching`, `/analytics`,
`/profile`, `/lookbook`, `/family`) were not touched and remain bearer-gated
as before.

---

## Database schema changes

| Model | Change |
|---|---|
| `User` | (unchanged in this release; `passwordHash` arrived earlier) |
| `WardrobeItem` | (unchanged shape; values written by `/ingest` now use the 14 canonical category strings) |
| **`Feedback`** (NEW) | `id`, `userId?`, `email?`, `message`, `userAgent?`, `source?`, `createdAt` + `@@index([createdAt])` |

No destructive migrations. `prisma db push --accept-data-loss` runs at
service start and adds the new table without touching existing rows.

---

## Env vars status on Railway

| Var | Set? | Effect if missing |
|---|---|---|
| `DATABASE_URL` | ✅ | (auto-provided by Railway Postgres add-on) |
| `GEMINI_API_KEY` | ✅ | Without it, ingest falls back to `FALLBACK_CLOTHING_ANALYSIS` (category=tops, confidence=0) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Without them, only email + demo login work |
| `JWT_SECRET` | ✅ | Without it, an ephemeral per-process secret is used and sessions don't persist across restarts |
| `APP_URL` | ✅ | Defaults to `https://${RAILWAY_PUBLIC_DOMAIN}` |
| **`CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`** | ❌ | Photos saved as data-URL blobs in Postgres rows — works but bloats DB. **Recommended** for production. |
| **`OPENWEATHER_API_KEY`** | ❌ | Weekly lookbook + weather-aware styling silently degrade. |
| `GOOGLE_PICKER_API_KEY` | ❌ | Drive picker falls back to custom DriveModal — empty list with drive.file scope unless picker is enabled. See ERRORS.md §2. |
| `DEBUG_UPLOAD` | n/a | Set to `1` on the server to print per-file timing logs from `/ingest` |

Full instructions to set the missing ones in
[.claude/railway-env-guide.md](.claude/railway-env-guide.md).

---

## QA regression — final results

Three parallel agents (`auth-flow`, `import/wardrobe`, `static`) ran against
the live deployment. Final outcome after applying the two P1 fixes:

| Agent | Verdict | Issues |
|---|---|---|
| auth-flow regression | **PASS** | 22/22 endpoints PASS, 0 P0, 0 P1 (state encoding fixed in `79f0c9b`) |
| import/wardrobe regression | **PASS** | 18/18 PASS — ingest, edit, alias normalization, demo flow |
| static code QA | **PASS** | TagEditor.tsx deleted in `79f0c9b`; all 22 i18n keys present in both locales |

Non-blocking notes (deferred):
- `confidence` field returns 0 when Gemini fallback fires (cosmetic; tags still
  flow correctly).
- Subcategory isn't cleared when category changes (e.g. user moves a t-shirt
  with subcategory "t-shirt" into `footwear` — subcategory stays "t-shirt").
  Out of scope; UX nice-to-have.
- Server log tags are only consistent on Drive paths (`[DRIVE]`); other
  handlers use plain `console.error`. Cosmetic.

---

## What's NOT in this release (intentionally)

- **Cloudinary** wiring — server has graceful fallback, but real production
  needs the env vars set. User action.
- **Weather** — same, user action.
- **Drive `drive.readonly` scope** — would require CASA audit. Current
  `drive.file` is verification-free; see ERRORS.md §2.
- **Wardrobe item subcategory auto-clear on category change** — flagged for
  follow-up.
- **iOS standalone PWA cookie eviction edge case** — flagged in ERRORS.md §1.

---

## How to extend

| Want to… | Edit |
|---|---|
| Add a new clothing section | `src/shared/wardrobe-categories.ts` (single file) + i18n labels |
| Add a new editable wardrobe field | `ItemPatchSchema` in `server/api/import.ts` + `WardrobeItemPatch` in `src/services/api.ts` + UI in `WardrobePage.ItemCard` |
| Change feedback storage (e.g. push to Slack) | `server/api/feedback.ts` — add a side-effect after `prisma.feedback.create` |
| Tighten upload size | `compressImageToBase64` second arg (maxDimension); current 1600 px |
| Audit auth flows | re-run agent: `auth-flow-tester` (playbook at `.claude/agents/auth-flow-tester.md`) |
| Bulk QA before commit | `/bug-sweep` skill |

---

## Recent commit history

```
79f0c9b fix(auth,import): close 2 P1s flagged by QA agents
d15d608 feat(wardrobe,import,feedback): direct-ingest + 14 categories + HEIC + feedback
3cc6330 feat(import): wire DropZone to incremental Drive consent flow
edfa7b4 feat(auth): drop Drive scope from sign-up, add incremental drive-consent
1aec872 fix(security): harden auth payload validation + JSON-only errors
0e9090c fix(deploy): remove invalid --skip-generate flag from db push
```

---

For known-limitations and edge-case workarounds, see **[ERRORS.md](ERRORS.md)**.
