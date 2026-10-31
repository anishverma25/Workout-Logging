-- Food logs can be measured in plates, bowls and ml as well (October 2026). Safe to run more
-- than once.
alter table public.food_logs drop constraint if exists food_logs_unit_check;
alter table public.food_logs add constraint food_logs_unit_check check (unit in (
  'katori', 'ladle', 'glass', 'cup', 'tbsp', 'tsp', 'piece', 'serving', 'share', 'g',
  'plate', 'bowl', 'ml'
));
