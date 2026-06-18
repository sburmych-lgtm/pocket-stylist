# Pocket Stylist — Railway env vars guide

Live: `https://pocket-stylist-production.up.railway.app`
Service in Railway: project `af0d2948-584c-4e3f-9194-20c5fc1a5cfa` / service `ccf7d53b-4b75-4642-bace-16528a4db870` / env `30ab2598-400b-43b0-b990-a129c5c706d7`.

## Current state from `/api/status` (as of 2026-05-15)

| Flag                          | Status | Required vars                                         |
|-------------------------------|--------|-------------------------------------------------------|
| `geminiConfigured`            | ✅     | `GEMINI_API_KEY`                                      |
| `googleSignInConfigured`      | ✅     | `GOOGLE_CLIENT_ID`                                    |
| `googleRedirectConfigured`    | ✅     | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`           |
| `googleDriveConfigured`       | ✅     | same as redirect (now relaxed in this commit)         |
| `googleDrivePickerConfigured` | ❌     | + `GOOGLE_PICKER_API_KEY` — falls back to DriveModal  |
| `cloudinaryConfigured`        | ❌     | `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` — without these, uploaded photos are stored as data URLs (heavy DB load) |
| `emailAuthEnabled`            | ✅     | always — self-contained password auth                 |

> **Weather** is now served by [Open-Meteo](https://open-meteo.com/), which is free and requires no API key. Geolocation comes from the browser (`navigator.geolocation`) or a city name (geocoded via the same provider) and is stored on the user record (`lat`, `lon`, `city`, `timezone`).

Also strongly recommended:
- `JWT_SECRET` — `crypto.randomBytes(64).toString('hex')`. Server logs a warning if missing in production.
- `APP_URL` — `https://pocket-stylist-production.up.railway.app` (server falls back to `RAILWAY_PUBLIC_DOMAIN`, but setting it explicitly avoids surprises).

## Why "Google login doesn't work" right now

The Google Cloud Console **OAuth client** (`730432934230-k1ck1i7krb1d85kb2fom6pr7jffdsm2d`) must list this URI in **Authorized redirect URIs**:

```
https://pocket-stylist-production.up.railway.app/api/auth/google/callback
```

If it doesn't, Google returns `redirect_uri_mismatch` and the callback fails silently (user gets `?authError=callback_failed` on the login page). To fix:

1. https://console.cloud.google.com/apis/credentials
2. Pick OAuth 2.0 Client ID matching the prefix `730432934230-…`
3. Under "Authorized redirect URIs" add the URL above. Save.

Wait ~5 minutes — Google's edge caches the OAuth client config.

## Getting the optional keys

### Cloudinary (free, 25 GB)
1. https://console.cloudinary.com — log in / sign up
2. Dashboard → "Account details" — copy Cloud name, API key, API secret
3. Railway → Variables → add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Google Picker API key (optional — DriveModal works without it)
1. https://console.cloud.google.com/apis/credentials → "Create credentials" → "API key"
2. Restrict it: HTTP referrers → add `https://pocket-stylist-production.up.railway.app/*`
3. Enable the Google Picker API: https://console.cloud.google.com/apis/library/picker.googleapis.com
4. Railway → Variables → add `GOOGLE_PICKER_API_KEY`

After adding any variable, Railway auto-redeploys. The `/api/status` endpoint reflects the new flags within ~30 seconds of redeploy.
