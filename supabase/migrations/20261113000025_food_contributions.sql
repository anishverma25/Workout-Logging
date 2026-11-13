-- Foods suggested by members for everyone (November 2026). Safe to run more than once.
--
-- A member who made a food of their own can suggest it for the shared library. Nothing reaches
-- other people until the owner has checked it. An approved food is sent to every signed-in
-- account by get_shared_foods(). As a quiet thank-you, each approved food gives its author 5%
-- off one Pro payment: the first in the month after approval, and each further one in the
-- month after that (so two foods in one month cover the next two months). It is applied by
-- itself at payment; the app says thank you only after a food is approved, and nowhere else.
--
-- The owner, in the SQL editor:
--   select * from public.food_review;                       -- what is waiting, newest first
--   select public.approve_food('<id>');                     -- publish it and thank the author
--   select public.approve_food('<id>', 'Better name');      -- publish under a corrected name
--   select public.reject_food('<id>', 'Numbers do not match the label');
--   select * from public.food_credits order by created_at desc;   -- thank-yous given and used
-- To correct a published food's numbers, update public.food_submissions directly.

create table if not exists public.food_submissions (
  id uuid primary key,
  -- Kept when the author deletes their account: the food stays for everyone.
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  diet text not null check (diet in ('veg', 'egg', 'nonveg')),
  -- Per 100 g, the same limits as a person's own food.
  kcal numeric(6, 1) not null check (kcal between 0 and 900),
  protein_g numeric(5, 1) not null check (protein_g between 0 and 100),
  carbs_g numeric(5, 1) not null check (carbs_g between 0 and 100),
  fat_g numeric(5, 1) not null check (fat_g between 0 and 100),
  fibre_g numeric(5, 1) not null default 0 check (fibre_g between 0 and 100),
  -- Grams in one serving, when it has one.
  piece_g numeric(6, 1) check (piece_g is null or (piece_g > 0 and piece_g <= 2000)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text not null default '' check (char_length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (protein_g + carbs_g + fat_g <= 101)
);
create index if not exists food_submissions_user_idx on public.food_submissions (user_id, created_at);
create index if not exists food_submissions_status_idx on public.food_submissions (status, reviewed_at);
alter table public.food_submissions enable row level security;
alter table public.food_submissions force row level security;
revoke all on public.food_submissions from anon, authenticated;

create table if not exists public.food_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  submission_id uuid not null unique references public.food_submissions (id) on delete cascade,
  percent integer not null default 5 check (percent between 1 and 50),
  valid_from date not null,
  valid_until date not null,
  used_at timestamptz,
  payment_ref text,
  created_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);
create index if not exists food_credits_user_idx on public.food_credits (user_id, valid_until);
alter table public.food_credits enable row level security;
alter table public.food_credits force row level security;
revoke all on public.food_credits from anon, authenticated;

alter table public.billing_orders add column if not exists credit_id uuid;

-- The most suggestions one account can send in a day, and have waiting at once.
create or replace function public.food_submit_limits() returns jsonb
language sql immutable set search_path = '' as $$ select '{"day": 5, "pending": 15}'::jsonb $$;

-- Suggest a food. The id is made on the phone, so sending twice adds nothing.
-- Returns 'pending', or the status it already has.
create or replace function public.submit_food(
  p_id uuid,
  p_name text,
  p_diet text,
  p_kcal numeric,
  p_protein numeric,
  p_carbs numeric,
  p_fat numeric,
  p_fibre numeric,
  p_piece_g numeric
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  existing text;
  from_macros numeric;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select s.status into existing from public.food_submissions s where s.id = p_id;
  if found then
    return existing;
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'Name length' using errcode = '22023';
  end if;
  if p_kcal is null or p_kcal <= 0 or p_protein is null or p_carbs is null or p_fat is null then
    raise exception 'Numbers missing' using errcode = '22023';
  end if;
  -- Calories must roughly match the macros (4, 4 and 9 kcal a gram), as on any real label.
  from_macros := 4 * p_protein + 4 * p_carbs + 9 * p_fat;
  if abs(p_kcal - from_macros) > greatest(40, 0.25 * p_kcal) then
    raise exception 'Calories and macros disagree' using errcode = '22023';
  end if;
  if (select count(*) from public.food_submissions s
      where s.user_id = uid and s.created_at > now() - interval '1 day')
     >= (public.food_submit_limits() ->> 'day')::int then
    raise exception 'Daily limit' using errcode = '22023';
  end if;
  if (select count(*) from public.food_submissions s
      where s.user_id = uid and s.status = 'pending')
     >= (public.food_submit_limits() ->> 'pending')::int then
    raise exception 'Too many waiting' using errcode = '22023';
  end if;
  -- The same name from the same person, still waiting or already in: nothing new to check.
  if exists (
    select 1 from public.food_submissions s
    where lower(s.name) = lower(v_name) and s.status <> 'rejected'
      and (s.user_id = uid or s.status = 'approved')
  ) then
    raise exception 'Already suggested' using errcode = '23505';
  end if;
  insert into public.food_submissions
    (id, user_id, name, diet, kcal, protein_g, carbs_g, fat_g, fibre_g, piece_g)
  values
    (p_id, uid, v_name, p_diet, p_kcal, p_protein, p_carbs, p_fat, coalesce(p_fibre, 0), p_piece_g);
  return 'pending';
end;
$$;
revoke all on function public.submit_food(uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.submit_food(uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- Every checked food, for every signed-in account. No authors.
create or replace function public.get_shared_foods()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'diet', s.diet,
      'kcal', s.kcal,
      'protein_g', s.protein_g,
      'carbs_g', s.carbs_g,
      'fat_g', s.fat_g,
      'fibre_g', s.fibre_g,
      'piece_g', s.piece_g
    ) order by s.reviewed_at)
    from public.food_submissions s
    where s.status = 'approved'
  ), '[]'::jsonb) end;
$$;
revoke all on function public.get_shared_foods() from public, anon;
grant execute on function public.get_shared_foods() to authenticated;

-- The caller's own suggestions and the thank-you that is open now, if any.
create or replace function public.get_my_food_thanks()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'foods', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'status', s.status)
        order by s.created_at desc)
      from public.food_submissions s where s.user_id = uid
    ), '[]'::jsonb),
    'credit', (
      select jsonb_build_object('percent', c.percent, 'valid_until', c.valid_until)
      from public.food_credits c
      where c.user_id = uid and c.used_at is null
        and today between c.valid_from and c.valid_until
      order by c.valid_until limit 1
    ),
    'credits_waiting', (
      select count(*)::int from public.food_credits c
      where c.user_id = uid and c.used_at is null and c.valid_until >= today
    )
  );
end;
$$;
revoke all on function public.get_my_food_thanks() from public, anon;
grant execute on function public.get_my_food_thanks() to authenticated;

-- Owner only (SQL editor) --------------------------------------------------------------------

create or replace view public.food_review
with (security_invoker = true) as
  select s.id, s.status, s.name, s.diet, s.kcal, s.protein_g, s.carbs_g, s.fat_g, s.fibre_g,
         s.piece_g, s.created_at, a.email as from_email
  from public.food_submissions s
  left join auth.users a on a.id = s.user_id
  order by (s.status = 'pending') desc, s.created_at desc;
revoke all on public.food_review from anon, authenticated;

-- Publishes a suggestion and thanks its author with one 5% credit: valid to the end of next
-- month, or, when they already hold credits, for the month after their last one.
create or replace function public.approve_food(p_id uuid, p_name text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.food_submissions;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  last_until date;
  v_from date;
  v_until date;
begin
  select * into s from public.food_submissions where id = p_id for update;
  if not found then
    raise exception 'No such suggestion' using errcode = 'P0002';
  end if;
  if s.status = 'approved' then
    return 'already approved';
  end if;
  update public.food_submissions
  set status = 'approved',
      name = coalesce(nullif(btrim(p_name), ''), name),
      reviewed_at = now()
  where id = p_id;
  if s.user_id is null then
    return 'approved';
  end if;
  select max(c.valid_until) into last_until
  from public.food_credits c
  where c.user_id = s.user_id and c.valid_until >= today;
  if last_until is null then
    v_from := today;
    v_until := (date_trunc('month', today) + interval '2 months' - interval '1 day')::date;
  else
    v_from := last_until + 1;
    v_until := (date_trunc('month', v_from) + interval '1 month' - interval '1 day')::date;
  end if;
  insert into public.food_credits (user_id, submission_id, valid_from, valid_until)
  values (s.user_id, s.id, v_from, v_until)
  on conflict (submission_id) do nothing;
  return format('approved, 5%% credit %s to %s', v_from, v_until);
end;
$$;
revoke all on function public.approve_food(uuid, text) from public, anon, authenticated;

create or replace function public.reject_food(p_id uuid, p_note text default '')
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.food_submissions
  set status = 'rejected', admin_note = left(coalesce(p_note, ''), 300), reviewed_at = now()
  where id = p_id and status = 'pending';
  return case when found then 'rejected' else 'nothing to reject' end;
end;
$$;
revoke all on function public.reject_food(uuid, text) from public, anon, authenticated;

-- Service role only: used by the billing function ---------------------------------------------

-- The thank-you credit open for this account today, if any.
create or replace function public.billing_credit(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', c.id, 'percent', c.percent)
  from public.food_credits c
  where c.user_id = p_user and c.used_at is null
    and (now() at time zone 'Asia/Kolkata')::date between c.valid_from and c.valid_until
  order by c.valid_until
  limit 1;
$$;
revoke all on function public.billing_credit(uuid) from public, anon, authenticated;
grant execute on function public.billing_credit(uuid) to service_role;

-- A confirmed payment used the credit.
create or replace function public.billing_credit_use(p_credit uuid, p_ref text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.food_credits set used_at = now(), payment_ref = p_ref
  where id = p_credit and used_at is null;
  return found;
end;
$$;
revoke all on function public.billing_credit_use(uuid, text) from public, anon, authenticated;
grant execute on function public.billing_credit_use(uuid, text) to service_role;

-- Remembers which credit an order was priced with; it is used up when the order is paid.
create or replace function public.billing_order_credit(p_order text, p_credit uuid, p_discount numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.billing_orders
  set credit_id = p_credit, discount_inr = coalesce(p_discount, 0)
  where id = p_order and status = 'created';
$$;
revoke all on function public.billing_order_credit(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.billing_order_credit(text, uuid, numeric) to service_role;

create or replace function public.billing_orders_use_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.credit_id is not null then
    update public.food_credits set used_at = now(), payment_ref = new.id
    where id = new.credit_id and used_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists billing_orders_use_credit on public.billing_orders;
create trigger billing_orders_use_credit after update on public.billing_orders
  for each row execute function public.billing_orders_use_credit();
