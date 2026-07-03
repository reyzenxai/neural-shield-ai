# Plans, Billing, and Payments Design

This is the specification for the new pricing model, the multi-user plans, and the
UPI payment flow. It is the reference for the phased build. Decisions locked with the
owner: payment is via a personal UPI with admin approval, the product name stays
Neural Shield AI, and scan quotas are per user.

## 1. Plans

Business is removed. The lineup is Free plus four paid plans. The single source of
truth for these numbers is `packages/config/index.ts` (the `PLANS` catalog), so the
website, the app logic, and the backend all read the same values.

| Plan | Price | Seats | Scans (per user) | Scanners | History | PDF |
|------|-------|-------|------------------|----------|---------|-----|
| Free | ₹0 | 1 | 10 / day | 5 text | 7 days | no |
| Individual | ₹149 | 1 | 150 / month, 30 / day | 5 text | 30 days | yes |
| Two-person | ₹219 | 2 | 110 / month, 22 / day | 5 text | 30 days | yes |
| Family | ₹299 | 4 | 75 / month, 15 / day | 5 text | 30 days | yes |
| Pro | ₹499 | 1 | Unlimited | All 7 | 60 days | yes |

Notes:
- "5 text" scanners are Message, URL, Email, Phone, and UPI. Screenshot and QR are
  Pro only, on every plan except Pro.
- Quotas are per user. In the Two-person plan each of the two people gets 110 per
  month. In Family each of the four gets 75 per month.
- The monthly number is the total for the month, and the daily number is a cap on
  top of it. Both count only the text scanners (Pro is unlimited so caps do not apply).

## 2. Data model changes

These land in Phase 2 as Supabase migrations.

- **`profiles.plan`**: widen the allowed values to `free`, `individual`,
  `two_person`, `family`, `pro`. Existing `business` rows are migrated to `pro`
  first, then `business` is dropped from the check constraint.
- **`plan_memberships`** (new): links a plan owner to the members they added.
  Columns: `id`, `owner_id`, `member_email`, `member_id` (null until that email is
  claimed by a real account), `slot` (1..3), `linked_at`, `email_locked_until`.
  Row Level Security: an owner can read and write only their own membership rows.
- **Per-user monthly usage**: add `profiles.monthly_scan_count` and
  `profiles.monthly_scan_reset_at`, alongside the existing daily counters. The daily
  and monthly counters are consumed together on each metered scan.
- **Effective plan**: a user's effective plan is their own `plan`, or, if they are a
  linked member on someone else's active plan, that plan. Resolved by a
  `SECURITY DEFINER` function so a member cannot see the owner's other data.
- **Billing month**: the cycle runs from the payment activation date. The monthly
  counter and the email-change lock both reset on that boundary.

## 3. Enforcement (Phase 2, backend)

The scan pipeline in the backend gains a plan-aware check before each scan:

1. Resolve the user's effective plan (own or inherited from a plan they are a member of).
2. If the scanner is Screenshot or QR and the plan is not Pro, reject with a clear
   "Pro feature" message.
3. If the plan has caps, check the per-user daily and monthly counters and reject with
   an "upgrade or wait" message when either is exceeded, otherwise consume one from both.
4. History views are filtered to the plan's retention window (7, 30, or 60 days).

The daily counter already exists. Monthly counting and per-scanner-set scoping are the
new parts. The free daily limit stays at its current value.

## 4. Multi-user plans (Phase 4)

Flow for Two-person and Family:

1. After the owner pays, they land on a "link your members" page and enter the Gmail
   addresses the other members used to sign up on Neural Shield (1 for Two-person, 3
   for Family).
2. Those emails are locked until the next billing month, whether the plan renews by
   the owner paying again or by autopay (autopay is not in scope for the UPI flow, so
   in practice this means the next paid month).
3. From then on, in the owner's profile there is a "Linked members" section. It asks
   whether they want to change a linked email, with a warning that a linked email can
   be changed only once in the current month. If they change it, they follow the same
   verify-the-email steps. If they do not, the option stays available for the rest of
   the month so they can change it whenever they want, still once.
4. A linked member sees their plan reflected as their effective plan and gets their own
   per-user quota. They cannot see the owner's scans or billing.

Edge cases to handle in the build: an entered email has no Neural Shield account yet
(hold the slot as pending until they sign up), a member is removed (their effective
plan falls back to Free), and the owner downgrades or lets the plan lapse (members
fall back to Free at the cycle end).

## 5. Payment (Phase 3): personal UPI with admin approval

Locked decision: pay to a personal UPI, then a person approves. This is honest about
what a personal UPI can and cannot do. It is not fully automatic and it does not
support autopay, because a personal UPI has no transaction-history API and no mandate
support. A future switch to a payment aggregator would make it fully automatic.

Flow:

1. The user picks a plan and clicks Upgrade.
2. They see the owner's UPI QR and UPI ID, the exact amount, and a unique reference
   note to put in the payment (so a payment can be matched to a request).
3. They pay in their own UPI app, then upload the payment screenshot.
4. The screenshot is stored in Supabase Storage, and OCR reads the amount and the UPI
   reference to pre-fill the review. A `payment_requests` row is created with status
   `pending`.
5. In the admin dashboard, the owner sees pending requests with the screenshot, the
   OCR-read amount and reference, and the expected amount. One click approves or
   rejects.
6. On approval, the user's plan is activated (or the member-linking step begins for the
   multi-user plans), the billing month starts, and the user is notified.

Honest caveats, on the record:
- Screenshots can be edited, so approval is a human check, not proof. Match the amount
  and the reference note against what actually arrived in your UPI app before approving.
- Collecting business payments on a personal UPI can conflict with bank terms and has
  tax implications. Moving to an aggregator later is recommended.

## 6. Subscribe and change emails (Phase 5)

A `subscribers` table stores an email and a confirmation state. A subscribe button and
form live on the site. When you publish an update, an n8n workflow reads the confirmed
subscribers and sends a "what changed" email. See `docs/n8n-self-hosted.md`.

## 7. Build phases

- Phase 1 (done): the `PLANS` catalog, the public pricing page (Business removed, four
  plans added), and the FAQ. Verified with a frontend build.
- Phase 2: Supabase migrations (plan values, membership table, monthly counters) and
  backend enforcement (caps, scanner gating, history retention).
- Phase 3: the UPI payment flow (QR, screenshot upload, OCR assist, admin approval,
  activation).
- Phase 4: multi-user linking and the once-a-month email change.
- Phase 5: the subscribe feature and the n8n workflows.

Each phase ships behind a verified build and its own migration, so nothing goes live
half-done.
