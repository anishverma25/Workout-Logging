-- Library additions after the personal training release, and early access.

-- Early access ------------------------------------------------------------------------------
-- While early access is open, every signed-in account has every Pro feature, with no trial
-- clock. Accounts created before it ends are founding members, and keep that status for good.
-- One row, only readable through get_my_subscription. To end early access (SQL editor):
--   update public.app_settings set early_access_ended_at = now();
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  early_access_ended_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;
revoke all on public.app_settings from anon, authenticated;

create or replace function public.get_my_subscription()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ended timestamptz := (select a.early_access_ended_at from public.app_settings a where a.id);
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
    'server_now', now(),
    'early_access', ended is null or now() < ended,
    'founding_member', ended is null or s.created_at < ended
  )
  into result
  from public.subscriptions s
  where s.user_id = uid;
  return result;
end;
$$;

revoke all on function public.get_my_subscription() from public, anon;
grant execute on function public.get_my_subscription() to authenticated;

-- Library ------------------------------------------------------------------------------------
-- The hip adduction (adductor) machine.

-- Generated from src/data/library/exercises.ts by src/data/sync/seed.ts. Do not edit by hand.
insert into public.exercises (
  id, key, name, primary_muscle, secondary_muscles, equipment, category, tracking_type,
  load_mode, instructions, created_at, updated_at
) values
  ('548049eb-7de7-44da-b4fe-749ca1832fe5', 'hip-adduction', 'Hip adduction machine', 'glutes', array[]::text[], 'machine', 'isolation', 'weight_reps', 'total', 'Also called the adductor machine; it works the inner thighs. Sit tall with the pads on the inside of the knees, squeeze the legs together, pause, then let them open slowly.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
on conflict (id) do update set
  key = excluded.key,
  name = excluded.name,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  category = excluded.category,
  tracking_type = excluded.tracking_type,
  load_mode = excluded.load_mode,
  instructions = excluded.instructions,
  updated_at = excluded.updated_at;
