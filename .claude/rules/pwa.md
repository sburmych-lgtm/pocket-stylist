---
paths:
  - "**/sw.*"
  - "**/service-worker*"
  - "**/manifest*"
  - "**/workbox*"
  - "public/**"
---
# PWA rules

## Service Worker (Workbox)
- Use workbox-webpack-plugin or vite-plugin-pwa for service worker generation.
- Cache strategy: NetworkFirst for API calls, CacheFirst for static assets and images.
- Precache: app shell (HTML, CSS, JS bundles, critical fonts).
- Runtime cache: Cloudinary images (CacheFirst, max 500 entries, 30-day expiry).
- Runtime cache: Gemini API responses (StaleWhileRevalidate for outfit suggestions).
- Never cache: auth tokens, user sessions, .env-derived data.
- Register service worker only in production builds.

## Manifest
- display: "standalone", orientation: "portrait"
- Include icons: 192x192, 512x512 (PNG), plus maskable versions.
- theme_color and background_color: match app's primary palette.
- start_url: "/" with ?source=pwa query param for analytics.

## Offline support
- Show offline indicator banner when navigator.onLine === false.
- Queue failed API requests for retry when connection restores.
- Cached outfit suggestions remain viewable offline.
- Camera/scanner features: show "requires internet" message when offline.

## Installation
- Show custom install prompt (beforeinstallprompt event).
- Defer prompt until user has completed onboarding (at least 5 items imported).
- Track install rate in analytics.
