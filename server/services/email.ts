import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { isConfiguredSecret } from "./app-status.js";

/**
 * Transactional email via SMTP (nodemailer). Provider-agnostic — point the
 * SMTP_* env vars at Gmail (App Password), Resend, SendGrid, Mailgun, Postmark
 * or any SMTP relay.
 *
 * Graceful degradation: with SMTP unconfigured, sendEmail() is a no-op that
 * returns false — the same "works without the key" pattern used for Stripe /
 * ElevenLabs here. SECURITY-SENSITIVE callers (password reset) must NOT branch
 * their HTTP response on the return value: the endpoint answers uniformly so a
 * missing SMTP key never leaks whether an address is registered.
 */

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? SMTP_USER ?? "Pocket Stylist <no-reply@pocket-stylist.app>";

export function isEmailConfigured(): boolean {
  return (
    isConfiguredSecret(SMTP_HOST) &&
    isConfiguredSecret(SMTP_USER) &&
    isConfiguredSecret(SMTP_PASS)
  );
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // implicit TLS on 465; STARTTLS on 587
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email. Returns true on success, false if SMTP is unconfigured or the
 * send failed. Never throws. Does not log recipient addresses.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    console.warn(`[email] SMTP not configured — skipped "${msg.subject}"`);
    return false;
  }
  try {
    await tx.sendMail({
      from: EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return true;
  } catch (err) {
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
