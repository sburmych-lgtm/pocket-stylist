---
description: Safety rules for all file operations (critical in bypass permissions mode)
globs:
---
# Safety rules
- You MAY obtain API keys via Playwright browser from service dashboards (Google AI Studio, Cloudinary, OpenWeatherMap, Google Cloud Console).
- You MAY also read pre-filled keys from G:\Веб-додатки\api-keys.txt as a fallback.
- You MAY create .env files with obtained keys for local development.
- You MUST ensure .env is in .gitignore BEFORE creating it.
- You MUST verify .env is NOT staged before every commit: `git diff --cached --name-only | grep '.env'`
- NEVER commit .env files, secrets, API keys, or private keys.
- Never run destructive commands (rm -rf, format, dd) without user confirmation.
- Never force-push to any branch.
- Never run git reset --hard without confirmation.
- If you discover sensitive data in code, warn immediately and remove it.
- Before deleting any file, verify it is not referenced elsewhere.
- Gemini API key: ONLY in .env and Railway env vars, never in code or commits.
- Cloudinary credentials: ONLY in .env and Railway env vars, never hardcoded.
- Google OAuth secrets (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET): env vars only.
- OpenWeatherMap API key: env vars only.
- SESSION_SECRET: env vars only, use crypto.randomBytes(64).toString('hex') to generate.
- User photos and selfies: process via Cloudinary, never store raw files on server.
- Never log or expose user photo URLs in error messages or console output.
- When creating .env.example: use placeholder values only (YOUR_KEY_HERE), never real keys.
