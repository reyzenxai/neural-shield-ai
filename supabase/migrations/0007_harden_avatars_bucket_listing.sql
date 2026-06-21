-- Neural Shield AI — harden avatars bucket (security advisor 0025)
--
-- STATUS: NOT yet applied to the live project — apply to close the advisor finding.
--
-- The avatars bucket is public, so object URLs are served from the public CDN
-- endpoint WITHOUT any SELECT policy. The broad `avatars_read` SELECT policy is
-- therefore unnecessary for display, but it lets any client LIST every file in
-- the bucket (storage.objects). The app only ever reads avatars by their known
-- public URL (lib/profile.ts → getPublicUrl), so dropping the listing policy is
-- safe and removes the enumeration surface.
--
-- Ref: https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing

drop policy if exists "avatars_read" on storage.objects;
