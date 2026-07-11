# Pocket Stylist — Roadmap / Deferred features

Living backlog. Items here are intentionally **deferred** until the base
functions are polished. Do not start them without the owner's go-ahead.

_Last updated: 2026-07-11._

---

## 🔜 Now — "perfect the base" (current focus)

1. **Confirm Gemini Tier 1 is live** (billing free-trial activated 2026-07-11;
   rate-limit tier still propagating). Background watcher polling.
2. **Speed up bulk import** once Tier 1 confirmed: set
   `GEMINI_CLOTHING_MIN_INTERVAL_MS=1000`, `VITE_IMPORT_CONCURRENCY=3` on Railway,
   re-run the owner's 10 photos on live → expect fast + zero false "needs review".
3. **Clean up existing wardrobe data** — the owner has items stuck as
   "needs review / unknown" from the rate-limit era. Fix path shipped:
   the "Re-analyze with AI" button (commit b385ea7). Once Tier 1 is live,
   re-analyse those items in place.
4. **Validate Smart Stylist output quality** on the real (cleaned) wardrobe —
   are the generated looks actually good? Feed real profile + weather + persona.
5. **End-to-end verification on the owner's real account** (not just demo).

---

## 📌 Deferred feature 1 — Home weather widget + prominent location control

**Status:** partially built. Geolocation + manual city input + Open-Meteo
(current + 7-day forecast) already exist (`useGeolocation`, `LocationRequest`,
`/api/profile/location`, `weather.ts`). Today the location prompt is only a
one-time banner that disappears after a location is saved.

**What the owner wants:**
- A persistent block at the **top of the Home page**: current location + today's
  weather, with a **"Change location"** button right under it.
- Support **manual location** (someone who won't share GPS, or is planning a trip
  to another city/country and wants outfits for *that* weather).
- Show **today + next 3 days** forecast inline (we already fetch it for free).
- Must look **beautiful, intuitive, effortless**.

**Effort:** ~half a day. Cheap (weather is already free via Open-Meteo). No new
external cost. Mostly a new `WeatherHeader` component + wiring the existing
forecast data + a location-picker modal reusing `LocationRequest`.

---

## 📌 Deferred feature 2 — Look generation / virtual try-on (rich version)

**Status:** basic Fal.ai try-on integration exists (`/api/styling/tryon`,
`fashn/tryon/v1.6`) but the owner reports the "generate look" flow doesn't
complete end-to-end. Needs a debugging pass.

**What the owner wants (bigger vision):**
- A dedicated onboarding step: user uploads **face/portrait photos (front +
  profile)** and **full-body photos**.
- The stylist uses these to assess **body type, face/head shape, skin tone** and
  other traits → better outfit selection and evaluation.
- The **same photos** feed the image generator: given (clothing photos + user
  photos + a purpose-built prompt), generate the actual user wearing the actual
  garments.

**Effort / risk:** HIGH. Per-generation cost (Fal.ai or Gemini image), prompt
engineering for identity+garment fidelity, storage of sensitive user body
photos (privacy/GDPR), and quality control. The owner explicitly said: **pause
here if it's economically unviable or technically hard.**

**Decision:** revisit only after the base is solid AND there's a paying-user
signal that justifies the per-image cost. Start with fixing the existing
basic try-on before attempting the richer flow.

---

## Notes
- Owner's standing priority: **finish base functions to perfection before new
  features.** When in doubt, polish core over adding surface.
