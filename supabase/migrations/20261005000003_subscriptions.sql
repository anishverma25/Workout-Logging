-- Trial and Pro access.
--
-- - Every account gets exactly one row, created by the database when the account is created.
--   The trial runs for exactly 168 hours from that moment, on the server clock.
-- - Users cannot insert, update or delete this table. They can only read their own row
--   (through get_my_subscription) and submit a UPI payment reference
--   (through submit_payment_reference).
-- - Pro is granted by an administrator in the Supabase SQL editor after checking the payment.
--   There is no admin page, admin flag or unlock code in the app.

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'trialing'
    check (status in ('trialing', 'payment_pending', 'active', 'expired', 'revoked')),
  trial_started_at timestamptz not null default now(),
  trial_expires_at timestamptz not null default now() + interval '168 hours',
  pro_started_at timestamptz,
  pro_expires_at timestamptz,
  payment_reference text check (payment_reference is null or payment_reference ~ '^[A-Za-z0-9-]{6,40}$'),
  payment_submitted_at timestamptz,
  -- For the administrator only. Never returned to the app.
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_expires_at = trial_started_at + interval '168 hours'),
  check (pro_expires_at is null or pro_started_at is null or pro_expires_at > pro_started_at)
);

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
-- Defence in depth: even with a grant, a user could only ever see their own row.
create policy subscriptions_select_own on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.subscriptions from anon, authenticated;

create or replace function public.subscriptions_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- The trial is fixed at creation and can never move.
  new.trial_started_at := old.trial_started_at;
  new.trial_expires_at := old.trial_expires_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.subscriptions_touch();

-- Start the trial when the account is created. Signing in again never touches it.
create or replace function public.start_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_start_trial after insert on auth.users
  for each row execute function public.start_trial();

-- Accounts that existed before this migration start their trial now.
insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- The signed-in user's access, with the server's clock so the app never relies on the device's.
create or replace function public.get_my_subscription()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'status', s.status,
    'trial_started_at', s.trial_started_at,
    'trial_expires_at', s.trial_expires_at,
    'pro_started_at', s.pro_started_at,
    'pro_expires_at', s.pro_expires_at,
    'payment_reference', s.payment_reference,
    'payment_submitted_at', s.payment_submitted_at,
    'updated_at', s.updated_at,
    'server_now', now()
  )
  into result
  from public.subscriptions s
  where s.user_id = uid;
  return result;
end;
$$;

-- The only change a user can make: record the UPI transaction reference of a payment, for the
-- administrator to check. It grants nothing by itself.
create or replace function public.submit_payment_reference(reference text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean text := upper(btrim(coalesce(reference, '')));
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if clean !~ '^[A-Z0-9-]{6,40}$' then
    raise exception 'Enter the transaction reference from your UPI app (6 to 40 letters or numbers)'
      using errcode = '22023';
  end if;
  update public.subscriptions
  set payment_reference = clean,
      payment_submitted_at = now(),
      status = case when status in ('trialing', 'expired') then 'payment_pending' else status end
  where user_id = uid;
  return public.get_my_subscription();
end;
$$;

revoke all on function public.get_my_subscription() from public, anon;
revoke all on function public.submit_payment_reference(text) from public, anon;
revoke all on function public.start_trial() from public, anon, authenticated;
grant execute on function public.get_my_subscription() to authenticated;
grant execute on function public.submit_payment_reference(text) to authenticated;
