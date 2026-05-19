# Known limitations & architectural constraints

Last updated: 2026-05-16 (commit `d15d608`)

This file collects every issue we hit during refactoring that is **not** a
bug to fix today, but a real constraint that future work needs to plan
around. Each entry says **what** is constrained, **why** we left it, and
**what the practical workaround is for users**.

---

## 1. HEIC / HEIF photo uploads on the desktop

### Status
✅ Auto-handled on the **client** via `heic2any` (lazy-loaded). Works for
common iPhone exports.

### Edge cases we deliberately did NOT solve
| Edge case | Why we didn't auto-fix | User workaround |
|-----------|------------------------|-----------------|
| HEIC with multiple frames (Live Photo, burst) | `heic2any` only returns the first frame; full-bundle handling would require `libheif-js` (~3 MB wasm) shipped to every visitor | The first frame is what the user sees in Photos anyway; behavior matches iOS Photos export to JPEG |
| HEIC > 25 MB (RAW-like exports) | Browser canvas memory blows up at ~25 MP on low-end Android Chrome | We surface `HEIC_CONVERSION_FAILED` and the UI tells the user to export a smaller JPEG |
| Animated HEIF (`.heifs`) | No real demand for "animated outfit photos"; cost = +1.5 MB to the bundle | Reject; user re-exports as JPEG |
| iOS Safari standalone PWA with restricted cookie scope | iOS sandboxes PWA `localStorage` from Safari for the same origin, occasionally evicting the JWT — orthogonal to HEIC | Re-login flow handles it; we keep `withTimeout` so a missing token doesn't hang |
| In-browser camera capture that produces HEIC | Most iOS Safari camera APIs still emit JPEG by default; HEIC only appears via the Files picker | Out of scope; no current report |

### When to revisit
- If we ever ship a "native iOS app" wrapping the PWA, swap `heic2any` for
  the native `PHPickerViewController` which delivers JPEG by default.
- If file sizes >25 MB become common, we'd need to add a server-side
  fallback: stream upload → run ImageMagick + `libheif` on a Railway
  worker → return JPEG. Adds ~$5/mo for a small worker, only pays off
  with real demand.

---

## 2. Google Drive — `drive.file` scope vs. `drive.readonly`

### Status
We sign users up with **basic** scopes (`openid email profile`) and use
incremental authorization to ask for **`drive.file`** when they actually
click the Drive button. `drive.readonly` is a **restricted** scope that
would require a paid CASA audit ($5–15k, 4–8 weeks). We chose `drive.file`
to keep the path verification-free and unblocked for paying users today.

### Trade-off
`drive.file` only grants the app access to files the user **picks** via a
Google Picker. That means:
- Native Google Picker (the polished UI) requires `GOOGLE_PICKER_API_KEY`
  in Railway env. If unset, our **custom DriveModal** is the fallback —
  but with `drive.file` alone, the REST `files.list` endpoint returns an
  empty list (it can only see files the app already created or that the
  user already shared with the app).
- Net effect: **Drive button currently works end-to-end only when
  `GOOGLE_PICKER_API_KEY` is configured.** Without it, the modal opens
  and shows an empty list.

### User workaround
Two options, both free:
1. Add `GOOGLE_PICKER_API_KEY` to Railway env (instructions in
   `.claude/railway-env-guide.md`). Restores the native Picker.
2. Use the regular file picker (camera + gallery) which works on all
   devices unchanged. iPhone users hit Photos → Select → Import.

### When to revisit
If revenue justifies it: go through CASA audit to unlock `drive.readonly`
so the custom modal can list arbitrary Drive folders without Picker.
Probably worth it only at >1000 paying users.

---

## 3. Server-side scope detection on incremental Drive consent

### Status
DropZone probes `GET /api/auth/google-access-token`; if it returns 200 we
assume the user has Drive scope. We do **not** call Google's
`tokeninfo` endpoint to verify the token actually contains
`drive.file` — that would add ~300 ms to every page load.

### Symptom
A user who:
1. Signed in with Google (basic scopes only)
2. Manually visits `/api/auth/google-access-token` (returns 200 with
   their basic token)
3. Then clicks Drive

…will get an "insufficient_scope" error from Drive REST instead of being
sent through the `drive-consent` upgrade flow. The error is logged with
the `[DRIVE]` tag.

### Workaround
The error path now lands the user in the `<ErrorBoundary>` toast, where
they can dismiss it and re-click Drive — the second click will route them
to `/api/auth/google/drive-consent` because their first attempt left a
session marker.

If this becomes a real friction point: cache the granted scope set in the
User row at consent time and read it in the probe. ~30 min of work.

---

## 4. Wardrobe category as `String`, not Postgres ENUM

### Status
We deliberately keep `WardrobeItem.category` as `String @db.Text` rather
than a Postgres ENUM. Adding a section is then a one-file change in
`src/shared/wardrobe-categories.ts`; renames don't require a destructive
SQL migration (the `normalizeCategory` alias table handles legacy values
at read time).

### Trade-off
- Slightly weaker integrity guarantees at the DB level.
- Categories list is enforced by **Zod** at every write boundary
  (`ingest`, `PATCH /wardrobe/:itemId`, demo store) and by the Gemini
  schema, so in practice the DB never sees invalid values.
- If we ever want hard SQL-level constraints, this can be a Phase-2
  migration: introduce a `wardrobe_categories` lookup table + FK in a
  single non-blocking deploy.

---

## 5. Bundle weight from `heic2any`

### Status
~ 715 KB minified (~ 230 KB gzipped) loaded lazily on first HEIC file.

### Trade-off
- Saves the bundle for everyone else (95% of uploads are JPEG/PNG).
- First HEIC drop sees an ~300 ms install delay before conversion.

### When to revisit
If somehow iOS Photos starts emitting HEIC into our flow for more than
50% of uploads (it currently auto-converts on iOS share-sheet → most
files come through as JPEG anyway), we'd pre-load the module instead of
lazy-loading. Behind a feature flag is easy.

---

## 6. Cloudinary not configured on Railway

### Status
Not strictly an error — server-side falls back gracefully to data-URL
mode. But every uploaded photo then lives as a base64 blob in the
Postgres row, which:
- Pumps row size to 2-5 MB
- Inflates the wardrobe list response to multi-MB JSON
- Defeats Postgres index efficiency

### Fix
Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET` in Railway → service redeploys automatically →
`cloudinary.uploader.upload` takes over. Free tier (25 GB) is enough for
~50k photos.

Detailed instructions: `.claude/railway-env-guide.md`.

---

## 7. OpenWeatherMap not configured

### Status
`weatherConfigured: false` → weekly lookbook + styling-with-weather
silently degrade to "no weather context".

### Fix
Same as Cloudinary — one env var (`OPENWEATHER_API_KEY`), free tier.

---

## 8. Mobile bottom-nav overlaps Feedback FAB on very small viewports

### Status
The FAB is positioned at `bottom-24` on mobile to clear the bottom-nav,
but on iPhone SE (320 × 568) it can still overlap the mobile nav's
center icon at extreme scroll positions.

### Workaround
Acceptable for now; if a user reports it, change to `bottom-32` and
shrink mobile-nav padding by 2 px. ~5 min fix.
