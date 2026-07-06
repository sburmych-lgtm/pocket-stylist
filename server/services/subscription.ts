import Stripe from "stripe";
import { prisma } from "./prisma.js";
import { isConfiguredSecret } from "./app-status.js";
import { isDemoUser } from "./demo-store.js";

/**
 * Stripe trial + paywall service.
 *
 * KEY INVARIANT: when STRIPE_SECRET_KEY is absent (the common case while we
 * onboard end-users), the whole module degrades gracefully — `getEffective
 * Subscription` reports `hasAccess: true` for everyone, and all the Stripe
 * calls (checkout / portal / webhook) become no-ops or 503s. This means the
 * app stays fully usable without Stripe, and the moment the user drops the
 * three env vars into Railway the gating kicks in.
 */

const TRIAL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const STRIPE_ENABLED =
  isConfiguredSecret(process.env.STRIPE_SECRET_KEY) &&
  isConfiguredSecret(process.env.STRIPE_PRICE_ID) &&
  isConfiguredSecret(process.env.STRIPE_WEBHOOK_SECRET);

let _stripe: Stripe | null = null;

/** Return a Stripe client, or null when STRIPE_SECRET_KEY isn't configured. */
export function getStripeClient(): Stripe | null {
  if (!STRIPE_ENABLED) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // Pin to a known recent API version so a future Stripe SDK upgrade
      // can't silently shift webhook payload shape.
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
      typescript: true,
      // SDK default is 80 s — a degraded Stripe API would pin /api/billing/*
      // requests for over a minute. 20 s + 1 retry is plenty.
      timeout: 20_000,
      maxNetworkRetries: 1,
    });
  }
  return _stripe;
}

export interface EffectiveSubscription {
  status: "trialing" | "active" | "past_due" | "canceled" | "none";
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  daysLeft: number;
  isPaid: boolean;
  hasAccess: boolean;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
}

export function daysLeftFrom(date: Date | null, now: number = Date.now()): number {
  if (!date) return 0;
  const diff = date.getTime() - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

/**
 * Pure compute helper — given a Subscription row (or null) and whether
 * Stripe is wired up, return the effective gating state. Extracted so unit
 * tests can verify all the access-control branches without touching Prisma.
 */
export function computeEffective(
  sub: {
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null,
  stripeEnabled: boolean,
  now: number = Date.now(),
): EffectiveSubscription {
  if (!sub) {
    return {
      status: "none",
      trialEndsAt: null,
      currentPeriodEnd: null,
      daysLeft: 0,
      isPaid: false,
      hasAccess: !stripeEnabled,
      cancelAtPeriodEnd: false,
      stripeConfigured: stripeEnabled,
    };
  }
  const status = (sub.status ?? "none") as EffectiveSubscription["status"];
  const trialActive =
    status === "trialing" &&
    sub.trialEndsAt !== null &&
    sub.trialEndsAt.getTime() > now;
  const isPaid = status === "active";
  const daysLeft = trialActive ? daysLeftFrom(sub.trialEndsAt, now) : 0;
  const hasAccess = !stripeEnabled || isPaid || trialActive;
  return {
    status,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    daysLeft,
    isPaid,
    hasAccess,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeConfigured: stripeEnabled,
  };
}

/**
 * Create a trial Subscription row for a newly signed-up user. Idempotent —
 * if a row already exists we leave it alone. Safe to call in fire-and-forget
 * mode after signup; callers should catch errors and never let this block
 * the signup response.
 */
export async function createTrialSubscription(userId: string): Promise<void> {
  if (!userId || isDemoUser(userId)) return;

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * MS_PER_DAY);
  await prisma.subscription.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      status: "trialing",
      trialEndsAt,
    },
  });
}

/**
 * Compute the effective subscription state for gating. This is the single
 * source of truth used by both the access middleware and the client banner.
 *
 * Without Stripe configured we ALWAYS return `hasAccess: true` so the app
 * remains fully functional — the trial concept exists in the DB but never
 * locks anyone out.
 */
export async function getEffectiveSubscription(
  userId: string,
): Promise<EffectiveSubscription> {
  // Demo users never see paywall.
  if (isDemoUser(userId)) {
    return {
      status: "active",
      trialEndsAt: null,
      currentPeriodEnd: null,
      daysLeft: 9999,
      isPaid: true,
      hasAccess: true,
      cancelAtPeriodEnd: false,
      stripeConfigured: STRIPE_ENABLED,
    };
  }

  let sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) {
    await createTrialSubscription(userId);
    sub = await prisma.subscription.findUnique({ where: { userId } });
  }
  return computeEffective(sub, STRIPE_ENABLED);
}

interface CheckoutOptions {
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout session for the configured Pro price. Returns
 * `null` when Stripe is not configured — callers should respond 503 in that
 * case rather than crashing.
 */
export async function createCheckoutSession(
  opts: CheckoutOptions,
): Promise<{ url: string; id: string } | null> {
  const stripe = getStripeClient();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !isConfiguredSecret(priceId)) return null;

  // Reuse an existing Stripe customer when we already created one for this
  // user — otherwise Checkout would create a duplicate customer each time.
  const sub = await prisma.subscription.findUnique({
    where: { userId: opts.userId },
    select: { stripeCustomerId: true },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer: sub?.stripeCustomerId ?? undefined,
    customer_email: sub?.stripeCustomerId ? undefined : opts.userEmail,
    client_reference_id: opts.userId,
    metadata: { userId: opts.userId },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: opts.userId },
    },
  });

  if (!session.url) return null;
  return { url: session.url, id: session.id };
}

/**
 * Create a Stripe Customer Portal session so the user can manage their card,
 * cancel, etc. Returns `null` if Stripe isn't configured OR the user has no
 * Stripe customer record yet (e.g. they never paid).
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string } | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  if (!sub?.stripeCustomerId) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

/**
 * Map a Stripe subscription object to our Subscription row update payload.
 * Kept pure so it's easy to test.
 */
export function stripeSubToDb(s: Stripe.Subscription): {
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
} {
  const item = s.items?.data?.[0];
  // Some Stripe API versions also expose `current_period_end` on the item;
  // probe both shapes defensively so a minor SDK bump can't break webhooks.
  const periodEndSec =
    (s as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number } | undefined)
      ?.current_period_end ??
    null;
  return {
    status: s.status,
    currentPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
    stripeSubscriptionId: s.id,
    stripePriceId: item?.price?.id ?? null,
  };
}

/**
 * Process a verified Stripe webhook event. Only handles the events we
 * actually care about for gating; everything else is acknowledged with no-op.
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        (session.metadata?.userId as string | undefined) ??
        (session.client_reference_id as string | undefined);
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      if (!userId || !customerId) return;

      await prisma.subscription.upsert({
        where: { userId },
        update: { stripeCustomerId: customerId },
        create: { userId, stripeCustomerId: customerId, status: "trialing" },
      });
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId =
        (sub.metadata?.userId as string | undefined) ?? (await resolveUserByCustomerId(sub.customer));
      if (!userId) return;
      const data = stripeSubToDb(sub);
      await prisma.subscription.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          ...data,
          stripeCustomerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        },
      });
      return;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId =
        typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (!customerId) return;
      const existing = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        select: { userId: true },
      });
      if (!existing) return;
      await prisma.subscription.update({
        where: { userId: existing.userId },
        data: { status: "past_due" },
      });
      return;
    }

    default:
      // Ignore events we don't care about — Stripe expects a 2xx anyway.
      return;
  }
}

async function resolveUserByCustomerId(
  customer: Stripe.Subscription["customer"],
): Promise<string | null> {
  const id = typeof customer === "string" ? customer : customer.id;
  if (!id) return null;
  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: id },
    select: { userId: true },
  });
  return sub?.userId ?? null;
}
