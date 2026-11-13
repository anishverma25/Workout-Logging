-- What the adaptive plan remembers (November 2026): things coming up (exams, travel, a fast),
-- something that hurts, each week's decision and its answer, temporary changes with how to put
-- them back, facts Macrotrophy AI may use, and planned meals. One small table for all of them.
-- Same rules as every other user table: client ids, user_id from auth.uid(), row level security
-- on every operation, newer change wins. Safe to run more than once.

create table if not exists public.plan_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('event', 'pain', 'decision', 'temporary', 'memory', 'meal_plan')),
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'done')),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 100000),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

drop trigger if exists plan_items_stamp on public.plan_items;
create trigger plan_items_stamp before insert or update on public.plan_items
  for each row execute function public.sync_stamp();
drop trigger if exists plan_items_keep_newer on public.plan_items;
create trigger plan_items_keep_newer before update on public.plan_items
  for each row execute function public.keep_newer();
create index if not exists plan_items_pull_idx on public.plan_items (user_id, server_updated_at);

alter table public.plan_items enable row level security;
alter table public.plan_items force row level security;
drop policy if exists plan_items_select_own on public.plan_items;
create policy plan_items_select_own on public.plan_items for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists plan_items_insert_own on public.plan_items;
create policy plan_items_insert_own on public.plan_items for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists plan_items_update_own on public.plan_items;
create policy plan_items_update_own on public.plan_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists plan_items_delete_own on public.plan_items;
create policy plan_items_delete_own on public.plan_items for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.plan_items from anon;
grant select, insert, update, delete on public.plan_items to authenticated;
