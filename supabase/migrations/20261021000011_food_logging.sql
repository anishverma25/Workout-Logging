-- Food logging: what people eat, their own foods and recipes, and two profile details (diet
-- type and their own katori size). Same rules as every other user table: client ids, user_id
-- from auth.uid(), row level security on every operation, newer change wins.
-- Safe to run more than once.

alter table public.profiles
  add column if not exists diet_type text check (diet_type in ('veg', 'egg', 'nonveg', 'jain')),
  add column if not exists katori_ml smallint check (katori_ml between 80 and 500);

create table if not exists public.custom_foods (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('food', 'recipe')),
  kcal numeric(6, 1) not null check (kcal between 0 and 900),
  protein_g numeric(5, 1) not null check (protein_g between 0 and 100),
  carbs_g numeric(5, 1) not null check (carbs_g between 0 and 100),
  fat_g numeric(5, 1) not null check (fat_g between 0 and 100),
  fibre_g numeric(5, 1) not null check (fibre_g between 0 and 100),
  piece_g numeric(6, 1) check (piece_g > 0 and piece_g <= 2000),
  servings smallint check (servings between 1 and 50),
  cooked_g numeric(7, 1) check (cooked_g > 0 and cooked_g <= 20000),
  ingredients jsonb check (
    ingredients is null or (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 40)
  ),
  diet text not null check (diet in ('veg', 'egg', 'nonveg')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.food_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'snacks', 'dinner')),
  food_id text not null check (char_length(food_id) between 1 and 80),
  food_name text not null check (char_length(food_name) between 1 and 80),
  amount numeric(7, 2) not null check (amount > 0 and amount <= 5000),
  unit text not null check (unit in (
    'katori', 'ladle', 'glass', 'cup', 'tbsp', 'tsp', 'piece', 'serving', 'share', 'g'
  )),
  size text check (size in ('small', 'medium', 'large')),
  grams numeric(7, 1) not null check (grams > 0 and grams <= 5000),
  oil_level text check (oil_level in ('light', 'normal', 'rich')),
  kcal numeric(7, 1) not null check (kcal between 0 and 10000),
  protein_g numeric(6, 1) not null check (protein_g between 0 and 1000),
  carbs_g numeric(6, 1) not null check (carbs_g between 0 and 1000),
  fat_g numeric(6, 1) not null check (fat_g between 0 and 1000),
  fibre_g numeric(6, 1) not null check (fibre_g between 0 and 1000),
  library_version integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

do $$
declare
  t text;
begin
  foreach t in array array['custom_foods', 'food_logs'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_stamp', t);
    execute format('create trigger %I before insert or update on public.%I
      for each row execute function public.sync_stamp()', t || '_stamp', t);
    execute format('drop trigger if exists %I on public.%I', t || '_keep_newer', t);
    execute format('create trigger %I before update on public.%I
      for each row execute function public.keep_newer()', t || '_keep_newer', t);
    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)',
      t || '_pull_idx', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (user_id = (select auth.uid()))', t || '_delete_own', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

create index if not exists food_logs_date_idx on public.food_logs (user_id, date desc);
