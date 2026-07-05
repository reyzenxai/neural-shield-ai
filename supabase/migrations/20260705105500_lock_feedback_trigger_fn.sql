-- Neural Shield AI — lock the feedback review-status trigger function.
-- Applied to production via MCP on 2026-07-05; mirrored here so repo = ledger.
--
-- feedback_set_review_status is a BEFORE INSERT trigger helper and must not be
-- callable directly via the REST API. The trigger still fires regardless of grants.
revoke execute on function public.feedback_set_review_status() from public;
