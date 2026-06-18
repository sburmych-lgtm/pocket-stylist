# Stripe setup — Pocket Stylist

This guide walks you through enabling paid subscriptions for Pocket Stylist.

> **TL;DR**: until the three env vars below are filled in, the app stays
> fully usable — every endpoint behaves as if `hasAccess: true`. The moment
> you set them in Railway, the 7-day trial + paywall flow turns on for new
> users automatically.

---

## 1. Create your Stripe account

1. Go to https://dashboard.stripe.com/register and finish onboarding (full
   business info — Stripe asks for VAT/EU details only when you start
   activating live payouts).
2. Stay in **Test mode** for the integration steps below. You will switch to
   Live mode at the end after a successful test purchase.

## 2. Create the Pro product and recurring price

1. In the dashboard, open **Products → + Add product**.
2. Name: `Pocket Stylist Pro` (or your preferred display name).
3. Pricing model: **Recurring**.
4. Price: `4.99 EUR` (or whatever you'd like; the FE picks the display value
   from `VITE_STRIPE_PRICE_DISPLAY`, default `€4.99/міс`).
5. Billing period: `Monthly`.
6. Save and copy the `price_...` ID from the new price block — this is your
   `STRIPE_PRICE_ID`.

## 3. Grab your API key

1. **Developers → API keys → Secret key** → reveal and copy.
2. While in Test mode this starts with `sk_test_...`. After verifying live
   mode you'll have `sk_live_...` — same env var, different value.
3. This is your `STRIPE_SECRET_KEY`.

## 4. Configure the webhook endpoint

1. **Developers → Webhooks → + Add endpoint**.
2. Endpoint URL:
   ```
   https://pocket-stylist-production.up.railway.app/api/billing/webhook
   ```
3. Listen to these events (minimum):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. After saving, click **Reveal signing secret** and copy `whsec_...` — this
   is your `STRIPE_WEBHOOK_SECRET`.

## 5. Set the env vars in Railway

> ⚠️ **DO NOT use the Raw Editor.** It has known cases where saving wipes
> existing variables silently. Always use `+ New Variable` for each item.

In your Railway project → **Variables** tab, click **+ New Variable** three
times and add:

| Name                    | Value                                |
| ----------------------- | ------------------------------------ |
| `STRIPE_SECRET_KEY`     | `sk_test_...` (or `sk_live_...`)     |
| `STRIPE_PRICE_ID`       | `price_...`                          |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...`                          |

Optional but recommended for the frontend display:

| Name                          | Value         |
| ----------------------------- | ------------- |
| `VITE_STRIPE_PRICE_DISPLAY`   | `€4.99/міс`   |

Railway redeploys automatically when variables change.

## 6. Smoke test (Test mode)

1. Open https://pocket-stylist-production.up.railway.app/api/status — confirm
   `"stripeConfigured": true`.
2. Sign up a fresh test account (e.g. `+stripe-test1@yourdomain`).
3. Navigate to `/style`, `/scan`, or `/match` — these should still work (trial
   is active for the first 7 days).
4. In the database manually shorten the trial to test the paywall:
   ```sql
   UPDATE subscriptions SET "trialEndsAt" = NOW() - INTERVAL '1 day'
   WHERE "userId" = '<your-test-user-id>';
   ```
5. Hit any AI endpoint — the 402 interceptor should pop the paywall modal.
6. Click **Перейти на Pro** → Stripe Checkout opens.
7. Use Stripe's test card `4242 4242 4242 4242`, any future date, any CVC.
8. After redirect back to the app, `/api/billing/me` should report
   `status: "active"` and the paywall stays closed.
9. Confirm the webhook in **Developers → Webhooks → your endpoint → Events** —
   you should see the four lifecycle events with `200 OK`.

## 7. Going Live

1. In Stripe dashboard top-left, flip **Test mode → Live mode**.
2. Re-create the same product + price in Live mode (different IDs!).
3. Re-create the webhook endpoint pointing at the same Railway URL.
4. Replace the three env vars in Railway with the live values (`sk_live_...`,
   the new `price_...`, the new `whsec_...`) — again, one variable at a time
   via **+ New Variable**.

## 8. Rolling back

If you ever need to disable billing without redeploying code, just delete
`STRIPE_SECRET_KEY` from Railway. The server will redetect `STRIPE_ENABLED =
false` on next boot and the gating turns off — every user gets unlimited
access again.

## Troubleshooting

- **`/api/status` reports `stripeConfigured: false`** — the env var either
  isn't set or matches a placeholder (`YOUR_KEY_HERE`, `MOCK_KEY`, empty
  string). Re-check it via Railway → Variables.
- **Webhook 400 `invalid_signature`** — `STRIPE_WEBHOOK_SECRET` doesn't match
  the endpoint you saved. Re-copy from the Stripe dashboard.
- **Webhook 400 `missing_signature`** — request didn't carry the
  `stripe-signature` header. Make sure Stripe is calling the endpoint, not a
  manual curl test.
- **Paywall opens during checkout success redirect** — the `checkout.session
  .completed` webhook hasn't been processed yet. Wait a few seconds and
  refresh `/api/billing/me`.
