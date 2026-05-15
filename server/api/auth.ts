import { Router } from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../services/prisma.js";
import { requireAuth, JWT_SECRET } from "../middleware/auth.js";
import { isConfiguredSecret } from "../services/app-status.js";

export const authRouter = Router();

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
}

async function upsertGoogleUser(profile: GoogleUserProfile) {
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
  };

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name ?? undefined,
        avatarUrl: profile.picture ?? undefined,
        ...tokenData,
      },
    });
  }

  return prisma.user.create({
    data: {
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      ...tokenData,
    },
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

    const { credential } = req.body as { credential: string };

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

    const user = await upsertGoogleUser({ googleId, email, name, picture });

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
    res.status(401).json({ error: "Google authentication failed" });
  }
});

// GET /api/auth/google/redirect — Start redirect-based OAuth flow (works on all mobile browsers)
authRouter.get("/google/redirect", (req: Request, res: Response) => {
  if (!isConfiguredSecret(GOOGLE_CLIENT_ID)) {
    res.status(503).json({ error: "Google auth not configured" });
    return;
  }

  const appUrl = getAppUrl(req);
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.readonly",
  ];

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account consent");

  res.redirect(authUrl.toString());
});

// GET /api/auth/google/callback — Handle redirect from Google
authRouter.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query as { code?: string; error?: string };
    const appUrl = getAppUrl(req);

    if (error || !code) {
      res.redirect(`${appUrl}/login?authError=${encodeURIComponent(error ?? "no_code")}`);
      return;
    }

    if (!isConfiguredSecret(GOOGLE_CLIENT_ID) || !isConfiguredSecret(GOOGLE_CLIENT_SECRET)) {
      res.redirect(`${appUrl}/login?authError=server_not_configured`);
      return;
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token exchange failed:", errBody);
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

    const user = await upsertGoogleUser({
      googleId,
      email,
      name,
      picture,
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token ?? null,
    });

    const appToken = signToken(user.id);

    res.redirect(`${appUrl}/login#token=${encodeURIComponent(appToken)}`);
  } catch (err) {
    console.error("Google callback error:", err);
    const appUrl = getAppUrl(req);
    res.redirect(`${appUrl}/login?authError=callback_failed`);
  }
});

// POST /api/auth/demo — Demo user login (always available as fallback)
authRouter.post("/demo", async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.upsert({
      where: { email: "demo@pocket-stylist.app" },
      update: {},
      create: { email: "demo@pocket-stylist.app", name: "Demo User" },
    });

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
    console.error("Demo auth error:", err);
    res.status(500).json({ error: "Failed to create demo session" });
  }
});

// GET /api/auth/me — Current user info (requires auth)
authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
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
      select: { googleAccessToken: true, googleRefreshToken: true },
    });

    if (!user?.googleAccessToken) {
      res.status(401).json({ error: "No Google access token. Please re-login via Google redirect." });
      return;
    }

    // If we have a refresh token, try to refresh the access token
    if (
      user.googleRefreshToken &&
      isConfiguredSecret(GOOGLE_CLIENT_ID) &&
      isConfiguredSecret(GOOGLE_CLIENT_SECRET)
    ) {
      try {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: user.googleRefreshToken,
            grant_type: "refresh_token",
          }),
        });

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

// POST /api/auth/logout — Placeholder (JWT is stateless)
authRouter.post("/logout", (_req: Request, res: Response) => {
  res.json({ ok: true });
});
