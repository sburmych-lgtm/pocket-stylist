import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../services/prisma.js";

// Augment Express Request with userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const DEMO_USER_EMAIL = "demo@pocket-stylist.app";

const JWT_SECRET =
  process.env.JWT_SECRET ?? "pocket-stylist-dev-secret";

function isDemoMode(): boolean {
  return !process.env.GOOGLE_CLIENT_ID;
}

async function ensureDemoUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Demo User" },
  });
  return user.id;
}

/**
 * Middleware that requires a valid JWT token or falls back to demo mode.
 * Attaches `req.userId` on success, responds 401 on failure.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Demo mode — auto-authenticate
  if (isDemoMode()) {
    req.userId = await ensureDemoUser();
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header required" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware that attaches `req.userId` if a valid token is present,
 * but does NOT reject the request when auth is missing.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (isDemoMode()) {
    req.userId = await ensureDemoUser();
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
  } catch {
    // Token invalid — proceed without userId
  }

  next();
}

export { JWT_SECRET, isDemoMode };
