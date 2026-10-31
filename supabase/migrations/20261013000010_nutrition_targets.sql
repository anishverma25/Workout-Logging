-- Nutrition targets the person sets themselves: daily calories and protein. Null means the app's
-- calculated targets are used. Safe to run more than once.

alter table public.profiles
  add column if not exists calorie_target smallint check (calorie_target between 800 and 8000),
  add column if not exists protein_target_g smallint check (protein_target_g between 20 and 500);
