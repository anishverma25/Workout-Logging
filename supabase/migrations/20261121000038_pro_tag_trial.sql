-- The Pro tag on the boards (November 2026, Anish's decision): members on the free Pro trial
-- show the tag too, and it goes away when the trial ends unless they buy Pro.
--
-- Before: only a paid plan or coaching showed it (a crown). The function keeps its name, so the
-- board functions that call it (community_scores callers in 0026) need no change. Results of
-- finished weeks and months were frozen with the flag they had.
create or replace function public.community_is_paid(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.status <> 'revoked' and (
      (s.pro_expires_at > now() and (s.pro_started_at is null or s.pro_started_at <= now()))
      or coalesce(s.coaching_expires_at > now(), false)
      or coalesce(s.trial_expires_at > now(), false)
    )
    from public.subscriptions s
    where s.user_id = p_user
  ), false);
$$;
revoke all on function public.community_is_paid(uuid) from public, anon, authenticated;
