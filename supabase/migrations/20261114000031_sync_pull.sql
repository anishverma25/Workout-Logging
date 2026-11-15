-- One request for a whole sync pull (November 2026, Fable review batch 3).
--
-- Before: the phone asked each of 18 tables separately on every sync round. Now it can send all
-- its cursors at once and get back the changed rows of every table in one answer.
--
-- - SECURITY INVOKER: it runs with the caller's own rights, so row level security decides what
--   comes back, exactly as when each table is asked separately.
-- - Only tables in public that have server_updated_at and row level security are read; any
--   other name is ignored. A table the server does not have yet is left out of the answer, and
--   the phone pulls it the old way (which knows how to skip a missing late table).
-- - Rows, order and cursors are the same as the per-table pull: rows after (ts, key) ordered by
--   (server_updated_at, key), at most p_limit (capped at 500) per table, as to_jsonb(row).
--
-- Safe to run before or after the app that uses it: a phone that does not find it pulls each
-- table as before.

create or replace function public.sync_pull(p_cursors jsonb, p_limit integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  t text;
  c jsonb;
  key_col text;
  rows jsonb;
  result jsonb := '{}'::jsonb;
  n integer := least(greatest(coalesce(p_limit, 200), 1), 500);
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_cursors is null or jsonb_typeof(p_cursors) <> 'object' then
    raise exception 'Cursors must be an object' using errcode = '22023';
  end if;
  for t, c in select * from jsonb_each(p_cursors) loop
    -- Only real, protected sync tables; anything else is skipped, never interpolated unchecked.
    continue when t !~ '^[a-z_]{1,40}$';
    continue when not exists (
      select 1 from pg_catalog.pg_class pc
      join pg_catalog.pg_namespace ns on ns.oid = pc.relnamespace
      where ns.nspname = 'public' and pc.relname = t and pc.relkind = 'r' and pc.relrowsecurity
    );
    continue when not exists (
      select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = t
        and ic.column_name = 'server_updated_at'
    );
    key_col := case when t = 'user_preferences' then 'user_id' else 'id' end;
    if c is null or jsonb_typeof(c) = 'null' then
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(r) order by r.server_updated_at, r.%1$I), ''[]''::jsonb)
         from (select * from public.%2$I order by server_updated_at, %1$I limit $1) r',
        key_col, t
      ) into rows using n;
    else
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(r) order by r.server_updated_at, r.%1$I), ''[]''::jsonb)
         from (
           select * from public.%2$I
           where server_updated_at > ($1 ->> ''ts'')::timestamptz
              or (server_updated_at = ($1 ->> ''ts'')::timestamptz and %1$I > ($1 ->> ''id'')::uuid)
           order by server_updated_at, %1$I
           limit $2
         ) r',
        key_col, t
      ) into rows using c, n;
    end if;
    result := result || jsonb_build_object(t, rows);
  end loop;
  return result;
end;
$$;
revoke all on function public.sync_pull(jsonb, integer) from public, anon;
grant execute on function public.sync_pull(jsonb, integer) to authenticated;
