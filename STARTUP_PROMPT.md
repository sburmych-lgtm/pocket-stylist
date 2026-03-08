# Pocket Stylist — Startup Prompts

---

## Variant 1: FULL AUTO (walk away mode)

```
You are building the Pocket Stylist PWA from scratch. Work fully autonomously.
The user has granted ALL permissions. Do not ask for confirmation — just execute.
Working directory: G:\Веб-додатки\Stylist (cd there first if not already).

SETUP:
1. Read CLAUDE.md, all .claude/rules/, and .claude/pipelines/pocket-stylist-pipeline.md
2. Create .gitignore FIRST (include .env, .env.*, node_modules, dist)
3. Obtain ALL API keys autonomously (see KEY SOURCING below)
4. Generate SESSION_SECRET: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
5. Create .env with all obtained keys + SESSION_SECRET
6. Verify .env is in .gitignore before ANY git operations

KEY SOURCING (use Playwright MCP browser for all):
Priority: check G:\Веб-додатки\api-keys.txt first — use any non-empty values from there.
For any MISSING keys, obtain them via Playwright browser:

a) GEMINI_API_KEY:
   → Navigate to https://aistudio.google.com/apikey
   → Google account is pre-authenticated in Playwright profile
   → Click "Create API key" or copy existing key
   → Save the key

b) GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET:
   → Navigate to https://console.cloud.google.com/apis/credentials
   → Create new project "Pocket Stylist" if needed
   → Configure OAuth consent screen (External, app name "Pocket Stylist")
   → Create OAuth 2.0 Client ID (Web application)
   → Add authorized redirect URIs: http://localhost:5173/auth/callback, https://<railway-url>/auth/callback
   → Copy Client ID and Client Secret

c) CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET:
   → Navigate to https://console.cloudinary.com/console
   → If logged in: copy credentials from Dashboard
   → If not logged in: try "Sign in with Google" (pre-authenticated)
   → Copy Cloud Name, API Key, API Secret from dashboard

d) OPENWEATHER_API_KEY:
   → Navigate to https://home.openweathermap.org/api_keys
   → If logged in: copy or create key
   → If not logged in: try "Sign in with Google" or existing account
   → Copy API key

If any key cannot be obtained (login wall, CAPTCHA, account not found):
→ Write the missing key name to .claude/blockers.md
→ Continue building — use mock/placeholder for that service
→ The app should still build and deploy without that specific feature

EXECUTION:
Execute ALL phases (0 through 5) sequentially.
For each phase:
  a) Use researcher agent to check current codebase state
  b) Read the phase spec from .claude/pipelines/pocket-stylist-pipeline.md
  c) Read relevant prompt templates from .claude/prompts/ when implementing Gemini features
  d) Plan (3-7 steps), write to .claude/plan.md
  e) Implement step by step. After each file: npm run typecheck && npm run lint
  f) Run verifier agent
  g) Stage SPECIFIC files (never git add -A), verify no .env staged
  h) Commit: git commit -m "feat(phase-N): description"
  i) Push: git push origin main
  j) Write progress to .claude/changes.md

GITHUB + RAILWAY (Phase 0):
- Create GitHub repo "pocket-stylist" via Playwright browser
- Push initial commit
- Go to railway.com via Playwright, create new project from GitHub repo
- Add PostgreSQL addon on Railway, copy DATABASE_URL
- Set ALL env vars on Railway via Playwright (same as .env but use Railway's DATABASE_URL)
- Verify deploy works

RECOVERY:
- Phase fails after 2 fix attempts → commit what works, write to .claude/blockers.md, move to next phase
- Railway deploy fails → check logs via Playwright, fix, re-push
- Gemini API errors → use gemini-debugger agent
- Context gets large → /compact "building phase N step M"
- Key not obtained → mock the service, add to blockers.md, continue

PLUGINS:
- Use /ralph-loop:ralph-loop --max-iterations 30
- Run /interface-design:init in Phase 0
- Use frontend-design skill for UI components

Output <promise>PIPELINE_COMPLETE</promise> when done.
```

---

## Variant 2: Single Phase

```
Read CLAUDE.md and .claude/pipelines/pocket-stylist-pipeline.md.
Execute Phase [N] only.
Use researcher agent first to check current codebase state.
Read prompt templates from .claude/prompts/ for any Gemini features.
After implementation: run verifier agent, commit, push.
Report what was built and what the next phase needs.
```

Replace [N] with 0, 1, 2, 3, 4, or 5.

---

## Variant 3: Continue from Checkpoint

```
Read CLAUDE.md, .claude/plan.md, and .claude/changes.md.
I was working on Phase [N]. Check what's already built, what's remaining.
Continue from where it left off — don't redo completed work.
After completion: verify, commit, push.
```

---

## Variant 4: Debug / Fix

```
Read CLAUDE.md.
There's an issue with [describe problem].
Use researcher agent to investigate.
If Gemini API issue: use gemini-debugger agent + compare with .claude/prompts/.
Fix, write a test, verify all checks pass.
Commit: git commit -m "fix: [description]"
```

---

## Variant 5: Deploy Only

```
Read CLAUDE.md.
Run verifier agent. Push to GitHub. Verify Railway via Playwright.
Report status.
```

---

## Variant 6: Codex Handoff Prep

```
Read CLAUDE.md.
Verify phases 0-5 complete: run tests, build, check routes via Playwright, test Gemini endpoint.
If broken — fix first. Report readiness for Codex restyle.
```
