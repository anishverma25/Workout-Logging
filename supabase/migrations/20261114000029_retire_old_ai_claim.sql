-- Run AFTER the coach Edge Function from November 2026 is deployed: it claims AI uses through
-- ai_claim as the service role, so the signed-in app no longer needs these two. Revoking them
-- means nobody can call them directly to spend or refund uses.

revoke execute on function public.claim_ai_use(text) from authenticated;
revoke execute on function public.release_ai_use(text) from authenticated;
