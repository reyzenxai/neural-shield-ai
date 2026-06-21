-- Neural Shield AI — prevent self-service plan escalation (decision D9 security fix)
-- Mirrors live migration 20260620185048.
--
-- Users must NOT be able to change their own `plan` (that only happens
-- server-side in the razorpay-checkout edge function after a verified payment).
-- Restrict authenticated UPDATEs to the safe, user-editable columns only.
revoke update on public.profiles from authenticated;
grant update (name, avatar_url, notification_prefs, daily_scan_count, daily_scan_reset_at)
  on public.profiles to authenticated;
