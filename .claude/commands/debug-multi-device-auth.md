---
name: debug-multi-device-auth
description: Diagnose and fix Google OAuth authentication issues across multiple devices. Use this skill when users report login problems on specific devices (phone vs desktop), session conflicts, "works on one device but not another" scenarios, Google Sign-In failures, JWT token issues, or any multi-device auth bug. Also triggers for "can't login on phone", "auth only works on one device", "Google login broken", or session management debugging.
---

# Debug Multi-Device Auth

Systematically diagnose why Google OAuth authentication might fail on some devices while working on others.

## Common root causes (check in this order)

1. **Single-session enforcement** — Code invalidates previous tokens when a new login occurs
2. **Device-specific Google Sign-In config** — Missing authorized origins/redirect URIs for mobile
3. **JWT token storage conflicts** — localStorage key collisions or PWA cache issues
4. **CORS restrictions** — Mobile browser sends different Origin header
5. **Service Worker caching** — PWA caches old auth responses
6. **Google OAuth consent screen** — App in "Testing" mode with limited test users

## Diagnostic workflow

### Step 1: Analyze auth backend

Read the auth-related files and check for session restrictions:

```
server/api/auth.ts          — Google token exchange, JWT creation
server/middleware/auth.ts   — JWT verification, session validation
src/contexts/AuthContext.tsx — Frontend auth state management
src/services/api.ts         — API client with token handling
src/pages/LoginPage.tsx     — Google Sign-In SDK initialization
```

Look specifically for:
- Any `WHERE` clause that limits active sessions per user (e.g., deleting old tokens on new login)
- Token revocation logic that runs on login
- `googleId` uniqueness constraints that might reject concurrent sessions
- Any session table or token blacklist mechanism
- Device fingerprinting or IP-based restrictions

### Step 2: Check Google Cloud Console config

Use Playwright to verify OAuth configuration:

1. Navigate to Google Cloud Console → APIs & Services → Credentials
2. Check the OAuth 2.0 Client ID used by the app
3. Verify **Authorized JavaScript origins** includes:
   - `http://localhost:5173` (dev)
   - `https://[railway-domain]` (production)
   - Any custom domain
4. Verify **Authorized redirect URIs** if using server-side flow
5. Check **OAuth consent screen**:
   - Publishing status: "In production" (not "Testing")
   - If "Testing": check if the user's email is in the test users list

### Step 3: Check JWT implementation

Verify the JWT setup allows multiple concurrent sessions:

- JWT should be **stateless** — no server-side session store that tracks "active" tokens
- Token verification should only check: signature validity + expiration
- There should be NO logic that:
  - Stores "current token" per user in the database
  - Invalidates previous tokens when a new one is issued
  - Limits concurrent sessions count

### Step 4: Check frontend token handling

- Verify `localStorage` key is consistent across devices (`pocket_stylist_token`)
- Check if Service Worker intercepts auth requests and serves cached responses
- Verify the Google Sign-In client ID matches between environments
- Check if `credential` from Google One Tap is properly forwarded to backend

### Step 5: Test on mobile (via Playwright or manual)

If Playwright is available with mobile emulation:
```
Use Playwright to:
1. Navigate to the app URL
2. Set mobile user agent and viewport
3. Attempt Google Sign-In flow
4. Check network requests for errors
5. Check console for JavaScript errors
```

### Step 6: Fix and verify

Based on findings, apply fixes. Common fixes:

**If single-session enforcement found:**
```typescript
// WRONG: Invalidating previous sessions
await prisma.user.update({ where: { googleId }, data: { currentToken: newToken } });

// RIGHT: Stateless JWT — just issue a new token, don't track it
const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
```

**If Google Cloud Console misconfigured:**
- Add missing origins/redirect URIs
- Move app from "Testing" to "Production" publishing status

**If Service Worker caching auth:**
- Add auth endpoints to SW exclusion list in `vite.config.ts` navigateFallbackDenylist

**After fixing:**
1. Run `npm run typecheck` to verify no type errors
2. Test locally with `npm run dev`
3. If changes affect deployed version, remind user to push to main for Railway auto-deploy

## Prisma schema check

Read `prisma/schema.prisma` and verify the User model doesn't have fields like:
- `currentToken` / `activeToken` / `sessionToken`
- `lastLoginDevice` / `deviceId`
- Any field that could be used to enforce single-device sessions

The User model should only store identity data (`email`, `googleId`, `name`) — not session state.

## Report format

```
## Auth Diagnostic Report

**Issue:** [description]
**Root cause:** [what was found]
**Affected files:** [list]

### Findings
1. [Finding with evidence]
2. ...

### Fix applied
- [What was changed and why]

### Verification
- [ ] TypeCheck passes
- [ ] Local login works
- [ ] Multiple concurrent sessions work
- [ ] Demo mode still works
```
