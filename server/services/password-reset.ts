import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

/**
 * Stateless password-reset tokens.
 *
 * A reset token is a short-lived signed JWT carrying:
 *   - sub:     userId
 *   - purpose: "pwreset"  (so an auth token can't be used as a reset token,
 *                          and vice-versa)
 *   - fp:      a short fingerprint of the user's CURRENT passwordHash
 *
 * The fingerprint makes the token effectively single-use: the moment the
 * password is changed the stored hash changes, so `fp` no longer matches and
 * the link — plus any older outstanding links — stops working. This gives us
 * one-time-use semantics with NO database table or migration.
 */

const RESET_PURPOSE = "pwreset";
const RESET_TTL_SECONDS = 60 * 60; // 1 hour

function fingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export function createResetToken(
  userId: string,
  passwordHash: string,
  secret: string,
): string {
  return jwt.sign({ purpose: RESET_PURPOSE, fp: fingerprint(passwordHash) }, secret, {
    subject: userId,
    expiresIn: RESET_TTL_SECONDS,
  });
}

export interface ResetTokenClaims {
  userId: string;
  fp: string;
}

export function verifyResetToken(token: string, secret: string): ResetTokenClaims | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string") return null;
    if (decoded.purpose !== RESET_PURPOSE) return null;
    if (typeof decoded.sub !== "string" || typeof decoded.fp !== "string") return null;
    return { userId: decoded.sub, fp: decoded.fp };
  } catch {
    return null;
  }
}

/**
 * True only if the token's fingerprint still matches the user's current
 * passwordHash. Rejects reused links and links minted before a prior reset.
 */
export function fingerprintMatches(passwordHash: string, fp: string): boolean {
  return fingerprint(passwordHash) === fp;
}
