import test from "node:test";
import assert from "node:assert/strict";
import {
  computeEffective,
  daysLeftFrom,
  stripeSubToDb,
} from "../server/services/subscription.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

test("daysLeftFrom returns 0 for past or null dates", () => {
  const now = Date.UTC(2026, 0, 15);
  assert.equal(daysLeftFrom(null, now), 0);
  assert.equal(daysLeftFrom(new Date(now - MS_PER_DAY), now), 0);
  assert.equal(daysLeftFrom(new Date(now), now), 0);
});

test("daysLeftFrom rounds up to the next whole day", () => {
  const now = Date.UTC(2026, 0, 15);
  // 1 day + 1 hour → ceil = 2
  assert.equal(daysLeftFrom(new Date(now + MS_PER_DAY + 3600_000), now), 2);
  // Exactly 3 days → 3
  assert.equal(daysLeftFrom(new Date(now + 3 * MS_PER_DAY), now), 3);
  // 0.5 day remaining → 1
  assert.equal(daysLeftFrom(new Date(now + MS_PER_DAY / 2), now), 1);
});

test("computeEffective: no Stripe + no subscription row → access stays open", () => {
  const eff = computeEffective(null, false);
  assert.equal(eff.status, "none");
  assert.equal(eff.hasAccess, true, "without Stripe everyone has access");
  assert.equal(eff.isPaid, false);
  assert.equal(eff.daysLeft, 0);
  assert.equal(eff.stripeConfigured, false);
});

test("computeEffective: Stripe enabled + no subscription row → blocked", () => {
  const eff = computeEffective(null, true);
  assert.equal(eff.status, "none");
  assert.equal(eff.hasAccess, false, "no row = no access when gating is on");
  assert.equal(eff.stripeConfigured, true);
});

test("computeEffective: active trial unlocks access (Stripe enabled)", () => {
  const now = Date.UTC(2026, 0, 15);
  const trialEndsAt = new Date(now + 4 * MS_PER_DAY);
  const eff = computeEffective(
    { status: "trialing", trialEndsAt, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    true,
    now,
  );
  assert.equal(eff.status, "trialing");
  assert.equal(eff.hasAccess, true);
  assert.equal(eff.isPaid, false);
  assert.equal(eff.daysLeft, 4);
});

test("computeEffective: expired trial + Stripe enabled → 402 territory", () => {
  const now = Date.UTC(2026, 0, 15);
  const trialEndsAt = new Date(now - MS_PER_DAY);
  const eff = computeEffective(
    { status: "trialing", trialEndsAt, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    true,
    now,
  );
  assert.equal(eff.hasAccess, false, "expired trial should be blocked when Stripe is on");
  assert.equal(eff.daysLeft, 0);
  assert.equal(eff.isPaid, false);
});

test("computeEffective: expired trial + Stripe DISABLED → still has access", () => {
  const now = Date.UTC(2026, 0, 15);
  const trialEndsAt = new Date(now - MS_PER_DAY);
  const eff = computeEffective(
    { status: "trialing", trialEndsAt, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    false,
    now,
  );
  assert.equal(
    eff.hasAccess,
    true,
    "without Stripe configured the gate must never close, even if the trial timestamp expired",
  );
});

test("computeEffective: active paid subscription has access regardless of trialEndsAt", () => {
  const now = Date.UTC(2026, 0, 15);
  const eff = computeEffective(
    {
      status: "active",
      trialEndsAt: null,
      currentPeriodEnd: new Date(now + 25 * MS_PER_DAY),
      cancelAtPeriodEnd: false,
    },
    true,
    now,
  );
  assert.equal(eff.hasAccess, true);
  assert.equal(eff.isPaid, true);
});

test("computeEffective: canceled subscription past trial → blocked when Stripe on", () => {
  const now = Date.UTC(2026, 0, 15);
  const eff = computeEffective(
    {
      status: "canceled",
      trialEndsAt: new Date(now - 30 * MS_PER_DAY),
      currentPeriodEnd: new Date(now - MS_PER_DAY),
      cancelAtPeriodEnd: true,
    },
    true,
    now,
  );
  assert.equal(eff.hasAccess, false);
  assert.equal(eff.isPaid, false);
  assert.equal(eff.status, "canceled");
});

test("computeEffective: past_due subscription is treated as no-access", () => {
  const now = Date.UTC(2026, 0, 15);
  const eff = computeEffective(
    {
      status: "past_due",
      trialEndsAt: null,
      currentPeriodEnd: new Date(now - MS_PER_DAY),
      cancelAtPeriodEnd: false,
    },
    true,
    now,
  );
  assert.equal(eff.hasAccess, false, "past_due means card failed — block until repaid");
});

test("stripeSubToDb maps a typical Stripe Subscription payload", () => {
  // Minimal shape — only the fields stripeSubToDb actually reads.
  const periodEndSec = Math.floor(Date.UTC(2026, 5, 1) / 1000);
  const fake = {
    id: "sub_test_123",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: periodEndSec,
    items: {
      data: [
        {
          current_period_end: periodEndSec,
          price: { id: "price_abc" },
        },
      ],
    },
  };
  // Cast to the Stripe type — we only verify the mapping the helper exposes.
  const mapped = stripeSubToDb(fake as unknown as Parameters<typeof stripeSubToDb>[0]);
  assert.equal(mapped.status, "active");
  assert.equal(mapped.stripeSubscriptionId, "sub_test_123");
  assert.equal(mapped.stripePriceId, "price_abc");
  assert.equal(mapped.cancelAtPeriodEnd, false);
  assert.ok(mapped.currentPeriodEnd instanceof Date);
  assert.equal(mapped.currentPeriodEnd!.getTime(), periodEndSec * 1000);
});

test("stripeSubToDb tolerates missing period end", () => {
  const fake = {
    id: "sub_no_period",
    status: "incomplete",
    cancel_at_period_end: true,
    items: { data: [{ price: { id: "price_xyz" } }] },
  };
  const mapped = stripeSubToDb(fake as unknown as Parameters<typeof stripeSubToDb>[0]);
  assert.equal(mapped.status, "incomplete");
  assert.equal(mapped.cancelAtPeriodEnd, true);
  assert.equal(mapped.currentPeriodEnd, null);
});
