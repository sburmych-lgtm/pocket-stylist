import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const STATE_TTL_MS = 10 * 60_000;

const OAuthStateSchema = z.object({
  nonce: z.string().min(16).max(128),
  flow: z.enum(["login", "drive"]),
  returnTo: z.string().max(512),
  acceptedTerms: z.boolean(),
  subjectUserId: z.string().min(1).max(128).optional(),
  issuedAt: z.number().int().nonnegative(),
});

export interface OAuthStateInput {
  nonce: string;
  flow: "login" | "drive";
  returnTo: string;
  acceptedTerms: boolean;
  subjectUserId?: string;
}

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/import";
  }
  return value;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOAuthState(
  input: OAuthStateInput,
  secret: string,
  now: Date = new Date(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      returnTo: safeReturnTo(input.returnTo),
      issuedAt: now.getTime(),
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyOAuthState(
  state: string | undefined,
  browserNonce: string | undefined,
  secret: string,
  now: Date = new Date(),
): OAuthStateInput | null {
  if (!state || !browserNonce) return null;
  const [payload, providedSignature, ...rest] = state.split(".");
  if (!payload || !providedSignature || rest.length > 0) return null;

  const expectedSignature = signature(payload, secret);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = OAuthStateSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (!parsed.success) return null;
    if (parsed.data.nonce !== browserNonce) return null;
    const age = now.getTime() - parsed.data.issuedAt;
    if (age < 0 || age > STATE_TTL_MS) return null;
    return {
      nonce: parsed.data.nonce,
      flow: parsed.data.flow,
      returnTo: safeReturnTo(parsed.data.returnTo),
      acceptedTerms: parsed.data.acceptedTerms,
      ...(parsed.data.subjectUserId
        ? { subjectUserId: parsed.data.subjectUserId }
        : {}),
    };
  } catch {
    return null;
  }
}

export function escapeInlineJson(value: string): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
