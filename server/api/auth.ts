import { Router } from "express";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../services/prisma.js";
import { requireAuth, JWT_SECRET } from "../middleware/auth.js";
import { isConfiguredSecret } from "../services/app-status.js";
import { DEMO_USER, DEMO_USER_EMAIL, isDemoUser } from "../services/demo-store.js";
import { withTimeout } from "../services/gemini-utils.js";
import { fetchWithTimeout } from "../services/http.js";
import { rateLimitByIp } from "../middleware/rate-limit.js";
import { createTrialSubscription } from "../services/subscription.js";
import { hashPassword, verifyPassword } from "../services/password.js";
import { createOAuthState, verifyOAuthState } from "../services/oauth-state.js";

// Anti-bot: 20 attempts / hour per IP for credential endpoints.
// Bounded enough to keep humans unaffected while pushing automated
// credential-stuffing well beyond the 24h-account-creation window.
const authLimiter = rateLimitByIp({ tag: "auth", limit: 20, windowMs: 60 * 60 * 1000 });

export const authRouter = Router();

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 254; // RFC 5321
const NAME_MAX_LENGTH = 100;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Type-safe extraction of an optional string field from request body.
function getStringField(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function getBoolField(body: unknown, key: string): boolean | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : undefined;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const oauthClient = isConfiguredSecret(GOOGLE_CLIENT_ID)
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

function getAppUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN)
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `${req.protocol}://${req.get("host")}`;
}

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

interface GoogleUserProfile {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string | null;
  acceptedTerms?: boolean;
  driveGranted?: boolean;
}

class TermsNotAcceptedError extends Error {
  constructor() {
    super("terms_not_accepted");
    this.name = "TermsNotAcceptedError";
  }
}

async function upsertGoogleUser(
  profile: GoogleUserProfile,
): Promise<{ user: Awaited<ReturnType<typeof prisma.user.update>>; isNew: boolean }> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId: profile.googleId },
        { email: profile.email },
      ],
    },
  });

  const tokenData = {
    ...(profile.googleAccessToken ? { googleAccessToken: profile.googleAccessToken } : {}),
    ...(profile.googleRefreshToken ? { googleRefreshToken: profile.googleRefreshToken } : {}),
    ...(profile.driveGranted ? { googleDriveGrantedAt: new Date() } : {}),
  };

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name ?? undefined,
        avatarUrl: profile.picture ?? undefined,
        ...tokenData,
      },
    });
    return { user, isNew: false };
  }

  if (profile.acceptedTerms !== true) {
    throw new TermsNotAcceptedError();
  }

  const user = await prisma.user.create({
    data: {
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      termsAcceptedAt: new Date(),
      ...tokenData,
    },
  });
  return { user, isNew: true };
}

// Fire-and-forget trial creation. Trial setup must NEVER block signup — if
// Prisma flakes, the user still gets a working session and a row will be
// lazily created the next time their effective subscription is computed.
function startTrialBackground(userId: string): void {
  createTrialSubscription(userId).catch((err) => {
    console.error("createTrialSubscription failed (non-fatal):", err);
  });
}

// POST /api/auth/google — Exchange Google ID token for app JWT
authRouter.post("/google", async (req: Request, res: Response) => {
  try {
    if (!oauthClient || !isConfiguredSecret(GOOGLE_CLIENT_ID)) {
      res
        .status(503)
        .json({ error: "Google auth not configured on this server" });
      return;
    }

    const credential = getStringField(req.body, "credential");
    const acceptedTerms = getBoolField(req.body, "acceptedTerms");

    if (!credential) {
      res.status(400).json({ error: "credential is required" });
      return;
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      res.status(401).json({ error: "Invalid Google token payload" });
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    const { user, isNew } = await upsertGoogleUser({
      googleId,
      email,
      name,
      picture,
      acceptedTerms,
    });
    if (isNew) startTrialBackground(user.id);

    const token = signToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    if (err instanceof TermsNotAcceptedError) {
      res.status(400).json({ error: "terms_not_accepted" });
      return;
    }
    res.status(401).json({ error: "Google authentication failed" });
  }
});

// Scope sets — kept minimal at sign-up so the OAuth consent screen does NOT
// require Google verification (basic scopes only). Drive access is requested
// later via incremental authorization when the user actually uses an import
// feature. We use `drive.file` (non-restricted, per-file) instead of
// `drive.readonly` (restricted, requires CASA audit) — same UX for selective
// imports, zero verification overhead.
const BASIC_SCOPES = ["openid", "email", "profile"];
const DRIVE_SCOPES = [
  isConfiguredSecret(process.env.GOOGLE_PICKER_API_KEY)
    ? "https://www.googleapis.com/auth/drive.file"
    : "https://www.googleapis.com/auth/drive.readonly",
];
const OAUTH_NONCE_COOKIE = "pocket_stylist_oauth_nonce";

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const entry of header.split(";")) {
    const [key, ...value] = entry.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function issueOAuthState(
  res: Response,
  flow: "login" | "drive",
  returnTo: string,
  acceptedTerms: boolean,
  subjectUserId?: string,
): string {
  const nonce = randomBytes(24).toString("base64url");
  const secure = process.env.NODE_ENV === "production";
  res.cookie(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 10 * 60_000,
    path: "/api/auth/google/callback",
  });
  return createOAuthState(
    { nonce, flow, returnTo, acceptedTerms, subjectUserId },
    JWT_SECRET,
  );
}

function clearOAuthStateCookie(res: Response): void {
  res.clearCookie(OAUTH_NONCE_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback",
  });
}

function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  prompt: string;
  state?: string;
  includeGrantedScopes?: boolean;
  loginHint?: string;
}): URL {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", params.clientId);
  authUrl.searchParams.set("redirect_uri", params.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", params.scopes.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", params.prompt);
  if (params.includeGrantedScopes) {
    authUrl.searchParams.set("include_granted_scopes", "true");
  }
  if (params.state) {
    authUrl.searchParams.set("state", params.state);
  }
  if (params.loginHint) {
    authUrl.searchParams.set("login_hint", params.loginHint);
  }
  return authUrl;
}

// GET /api/auth/google/redirect — sign-up / sign-in (BASIC SCOPES ONLY)
authRouter.get("/google/redirect", (req: Request, res: Response) => {
  if (!isConfiguredSecret(GOOGLE_CLIENT_ID)) {
    res.status(503).json({ error: "Google auth not configured" });
    return;
  }

  const appUrl = getAppUrl(req);
  const acceptedTerms = req.query.acceptedTerms === "1";
  const authUrl = buildGoogleAuthUrl({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: `${appUrl}/api/auth/google/callback`,
    scopes: BASIC_SCOPES,
    prompt: "select_account",
    state: issueOAuthState(res, "login", "/import", acceptedTerms),
  });

  res.redirect(authUrl.toString());
});

// POST /api/auth/google/drive-consent — incremental auth: add Drive scope to
// an already signed-in user so they can use the Drive picker. The frontend
// triggers this when the user clicks the Drive button for the first time.
authRouter.post("/google/drive-consent", requireAuth, async (req: Request, res: Response) => {
  if (!isConfiguredSecret(GOOGLE_CLIENT_ID)) {
    res.status(503).json({ error: "Google auth not configured" });
    return;
  }

  const appUrl = getAppUrl(req);

  // Where to bounce the user once Drive is granted (default = import page).
  const returnTo = getStringField(req.body, "returnTo") ?? "/import";

  // login_hint lets Google preselect the user that's currently signed in.
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { email: true },
  });
  const loginHint = user?.email;

  const authUrl = buildGoogleAuthUrl({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: `${appUrl}/api/auth/google/callback`,
    scopes: [...BASIC_SCOPES, ...DRIVE_SCOPES],
    prompt: "consent",
    includeGrantedScopes: true,
    // Pass returnTo through `state` without pre-encoding — URLSearchParams
    // (inside buildGoogleAuthUrl) does that exactly once. Otherwise the slash
    // would be double-encoded and the callback couldn't route the user back.
    state: issueOAuthState(res, "drive", returnTo, true, req.userId),
    loginHint,
  });

  res.json({ url: authUrl.toString() });
});

// GET /api/auth/google/callback — Handle redirect from Google
// Handles BOTH the sign-up flow (basic scopes only, state empty) and the
// incremental Drive-consent flow (state starts with "drive:<returnTo>").
authRouter.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const { code, error, state } = req.query as {
      code?: string;
      error?: string;
      state?: string;
    };
    const appUrl = getAppUrl(req);

    const oauthState = verifyOAuthState(
      state,
      getCookie(req, OAUTH_NONCE_COOKIE),
      JWT_SECRET,
    );
    clearOAuthStateCookie(res);
    if (!oauthState) {
      res.redirect(`${appUrl}/login?authError=invalid_oauth_state`);
      return;
    }
    const isDriveFlow = oauthState.flow === "drive";
    const driveReturnTo = oauthState.returnTo;
    const errorRedirect = isDriveFlow
      ? `${appUrl}${driveReturnTo}`
      : `${appUrl}/login`;

    if (error || !code) {
      const sep = errorRedirect.includes("?") ? "&" : "?";
      res.redirect(
        `${errorRedirect}${sep}authError=${encodeURIComponent(error ?? "no_code")}`,
      );
      return;
    }

    if (!isConfiguredSecret(GOOGLE_CLIENT_ID) || !isConfiguredSecret(GOOGLE_CLIENT_SECRET)) {
      const sep = errorRedirect.includes("?") ? "&" : "?";
      res.redirect(`${errorRedirect}${sep}authError=server_not_configured`);
      return;
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // Exchange authorization code for tokens (10 s deadline — a hung Google
    // endpoint must not pin the callback request).
    const tokenRes = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    }, 10_000);

    if (!tokenRes.ok) {
      console.error("Google token exchange failed", { status: tokenRes.status });
      res.redirect(`${appUrl}/login?authError=token_exchange_failed`);
      return;
    }

    const tokens = (await tokenRes.json()) as {
      id_token: string;
      access_token: string;
      refresh_token?: string;
    };

    // Verify the id_token
    const ticket = await oauthClient!.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      res.redirect(`${appUrl}/login?authError=invalid_token`);
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    if (isDriveFlow && oauthState.subjectUserId) {
      const expectedUser = await prisma.user.findUnique({
        where: { id: oauthState.subjectUserId },
        select: { email: true },
      });
      if (!expectedUser || expectedUser.email.toLowerCase() !== email.toLowerCase()) {
        res.redirect(`${appUrl}/login?authError=google_account_mismatch`);
        return;
      }
    }

    const { user, isNew } = await upsertGoogleUser({
      googleId,
      email,
      name,
      picture,
      googleAccessToken: isDriveFlow ? tokens.access_token : undefined,
      googleRefreshToken: isDriveFlow ? tokens.refresh_token ?? null : undefined,
      acceptedTerms: oauthState.acceptedTerms,
      driveGranted: isDriveFlow,
    });
    if (isNew) startTrialBackground(user.id);

    const appToken = signToken(user.id);

    // For Drive-consent flow the user is already logged in; just bounce them
    // back to where they were (returnTo) without re-issuing a token in the URL.
    // The newly persisted access token (with drive.file scope) is on the User
    // record server-side, so the next /api/auth/google-access-token call works.
    const target = isDriveFlow
      ? new URL(driveReturnTo, appUrl)
      : new URL("/login", appUrl);
    if (isDriveFlow) target.searchParams.set("driveGranted", "1");
    else target.hash = `token=${encodeURIComponent(appToken)}`;
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, target.toString());
  } catch (err) {
    console.error("Google callback error:", err);
    const appUrl = getAppUrl(req);
    if (err instanceof TermsNotAcceptedError) {
      res.redirect(`${appUrl}/login?authError=terms_not_accepted`);
      return;
    }
    res.redirect(`${appUrl}/login?authError=callback_failed`);
  }
});

// POST /api/auth/demo — Demo user login.
// Pure in-memory: no Prisma upsert, no FK relations. This guarantees that
// (a) the JWT always carries `userId = DEMO_USER_ID` so every protected
// route lands in the isDemoUser() branch (which is where ensureDemoSeed
// pre-populates 10 stock items), and (b) /demo works even when Postgres
// is offline — exactly the contract the FE relies on for the "Try the
// demo" link on the login page.
authRouter.post("/demo", (_req: Request, res: Response) => {
  try {
    const token = signToken(DEMO_USER.id);
    res.json({
      token,
      user: {
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        name: DEMO_USER.name,
        avatarUrl: null,
      },
    });
  } catch (err) {
    console.error("Demo auth error:", err);
    res.status(500).json({ error: "Failed to create demo session" });
  }
});

// GET /api/auth/me — Current user info (requires auth)
authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    if (isDemoUser(req.userId)) {
      res.json({ user: DEMO_USER });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        colorSeason: true,
        genderMode: true,
        createdAt: true,
        lat: true,
        lon: true,
        city: true,
        timezone: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error("Auth me error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// GET /api/auth/google-access-token — Return user's Google access token (for Drive Picker)
authRouter.get("/google-access-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleDriveGrantedAt: true,
      },
    });

    if (!user?.googleDriveGrantedAt || !user.googleAccessToken) {
      res.status(401).json({ error: "drive_access_required" });
      return;
    }

    // If we have a refresh token, try to refresh the access token
    if (
      user.googleRefreshToken &&
      isConfiguredSecret(GOOGLE_CLIENT_ID) &&
      isConfiguredSecret(GOOGLE_CLIENT_SECRET)
    ) {
      try {
        const refreshRes = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: user.googleRefreshToken,
            grant_type: "refresh_token",
          }),
        }, 10_000);

        if (refreshRes.ok) {
          const tokens = (await refreshRes.json()) as { access_token: string };
          await prisma.user.update({
            where: { id: req.userId! },
            data: { googleAccessToken: tokens.access_token },
          });
          res.json({ accessToken: tokens.access_token });
          return;
        }
      } catch {
        // Refresh failed, try with existing token
      }
    }

    res.json({ accessToken: user.googleAccessToken });
  } catch (err) {
    console.error("Get access token error:", err);
    res.status(500).json({ error: "Failed to get access token" });
  }
});

// POST /api/auth/email/register — Register with email and password
authRouter.post("/email/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const emailRaw = getStringField(req.body, "email");
    const password = getStringField(req.body, "password");
    const nameRaw = getStringField(req.body, "name");
    const acceptedTerms = getBoolField(req.body, "acceptedTerms");

    if (emailRaw === undefined || password === undefined) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    // GDPR: explicit opt-in required for new sign-ups. Existing accounts
    // pre-dating this requirement are grandfathered (termsAcceptedAt NULL).
    if (acceptedTerms !== true) {
      res.status(400).json({ error: "terms_not_accepted" });
      return;
    }

    const normalizedEmail = emailRaw.trim().toLowerCase();
    if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
      res.status(400).json({ error: "email_too_long" });
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      res.status(400).json({ error: "password_too_short" });
      return;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      res.status(400).json({ error: "password_too_long" });
      return;
    }
    if (normalizedEmail === DEMO_USER_EMAIL) {
      res.status(400).json({ error: "email_reserved" });
      return;
    }
    if (nameRaw !== undefined && nameRaw.length > NAME_MAX_LENGTH) {
      res.status(400).json({ error: "name_too_long" });
      return;
    }

    const name = nameRaw?.trim() || null;

    const existing = await withTimeout(
      prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, passwordHash: true },
      }),
      5_000,
      "Database lookup timed out",
    );
    if (existing) {
      res.status(409).json({ error: "email_in_use" });
      return;
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await withTimeout(
        prisma.user.create({
          data: {
            email: normalizedEmail,
            name,
            passwordHash,
            termsAcceptedAt: new Date(),
          },
        }),
        5_000,
        "Database create timed out",
      );
    } catch (createErr) {
      // Unique-violation race: two concurrent registrations for the same
      // email both pass the findUnique above — the loser must get a clean
      // 409, not a 500.
      const code = (createErr as { code?: string } | null)?.code;
      if (code === "P2002") {
        res.status(409).json({ error: "email_in_use" });
        return;
      }
      throw createErr;
    }
    startTrialBackground(user.id);

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Email register error:", err);
    res.status(500).json({ error: "registration_failed" });
  }
});

// POST /api/auth/email/login — Login with email and password
authRouter.post("/email/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const emailRaw = getStringField(req.body, "email");
    const password = getStringField(req.body, "password");

    if (emailRaw === undefined || password === undefined) {
      res.status(400).json({ error: "invalid_credentials" });
      return;
    }

    const normalizedEmail = emailRaw.trim().toLowerCase();

    if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({ error: "invalid_credentials" });
      return;
    }

    const user = await withTimeout(
      prisma.user.findUnique({
        where: { email: normalizedEmail },
      }),
      5_000,
      "Database lookup timed out",
    );

    if (!user?.passwordHash) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Email login error:", err);
    res.status(500).json({ error: "login_failed" });
  }
});

// POST /api/auth/refresh — rotate a still-valid app JWT before it expires.
authRouter.post("/refresh", requireAuth, (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ token: signToken(req.userId!) });
});

// POST /api/auth/logout — Placeholder (JWT is stateless)
authRouter.post("/logout", (_req: Request, res: Response) => {
  res.json({ ok: true });
});
