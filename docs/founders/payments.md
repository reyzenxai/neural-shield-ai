# Payments

> Today's active flow is **UPI + admin approval**. Razorpay code exists but is **dormant**. Prices
> and quotas live in one place: `packages/config` `PLANS`.

## Plans (single source of truth: `packages/config`)

| Plan | Price/mo | Seats | Daily / Monthly scans | Notes |
|---|---|---|---|---|
| Free | ₹0 | 1 | 10 / — | Text scanners, 7-day history. |
| Individual | ₹149 | 1 | 30 / 150 | 30-day history. |
| Two-person | ₹219 | 2 | 22 / 110 | Owner links 1 member by email. |
| Family | ₹299 | 4 | 15 / 75 | Owner links up to 3 members. |
| Pro | ₹499 | 1 | unlimited | All 7 scanners, API keys, PDF export, 60-day history. |

Amounts are **fixed server-side** — a client cannot tamper with the price.

## Active flow: UPI + admin approval

```
User picks a paid plan
  → app builds a upi://pay link + a unique reference note + a QR (via api.qrserver.com)
  → user pays in their UPI app and screenshots it
  → user enters the UPI reference + uploads the screenshot
  → insert into payment_requests (status=pending) + upload to the payment-proofs bucket
Admin (/admin/payments)
  → admin_list_payments('pending')
  → admin_approve_payment(id)  → sets the plan + resets daily/monthly counters
User's plan is active on the next token/profile refresh.
```

Code: `PlanUpgrade.tsx` → `lib/payments.ts` → `payment_requests` table + `payment-proofs` bucket.
Approval/rejection are `SECURITY DEFINER` admin RPCs that re-check `is_admin` and log to
`admin_logs`.

## Multi-user plans

Two-person/Family owners link members by email in the profile ("Linked members"). A member inherits
the owner's plan via `app_effective_plan`. There's a 30-day email-change lock
(`email_locked_until`) to prevent seat abuse.

## Razorpay (dormant / superseded)

`supabase/functions/razorpay-checkout/index.ts` creates a Razorpay order and verifies the HMAC
signature before upgrading a plan. It stays **inert** (returns 503) until `RAZORPAY_KEY_ID/SECRET`
are set. On the security branch its `PRICES` map was corrected (removed the deleted `business` plan;
fixed the `pro` price to ₹499) so it can't mis-charge if reactivated. `frontend/src/lib/billing.ts`
(the old client side) is dead code.

## Admin: approving a payment
1. Go to `/admin/payments` (requires `is_admin`).
2. Verify the uploaded screenshot and UPI reference against your UPI transaction history.
3. Click approve → the user's plan and counters update; the action is logged.
4. Reject with an optional note if the proof doesn't match.

## Risks & notes
- UPI approval is **manual** and trust-on-first-use (auto-verification isn't feasible on a personal
  UPI VPA). Reconcile against your bank/UPI statement before approving.
- `api.qrserver.com` is a third-party image dependency on the upgrade page (the QR only encodes a
  local `upi://` string — no secret leaves). Generating the QR locally is a low-priority backlog item.
- For an automated gateway at scale, reactivate/replace the Razorpay path (see
  [future-roadmap.md](future-roadmap.md)).
