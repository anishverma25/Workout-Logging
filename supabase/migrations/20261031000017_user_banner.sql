-- A personal message on Home for one account (October 2026), for example a thank you to a
-- milestone user. Set by the administrator in the SQL editor (docs/admin-pro-payments.md).
--
-- Additive and nullable: accounts without a message behave exactly as before, and app versions
-- already on phones ignore the two new fields in get_my_subscription().
--
-- Users still cannot read or write the table. They only receive their own message, through
-- get_my_subscription(), and only while it has not expired on the server clock.

alter table public.subscriptions
  add column banner_message text
    check (banner_message is null or char_length(btrim(banner_message)) between 1 and 280),
  add column banner_expires_at timestamptz;

-- Same function as in 20261011000009_pay_once.sql, plus the message.
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
    'founding_member', ended is null or s.created_at < ended,
    'billing_plan', s.billing_plan,
    'billing_kind', s.billing_kind,
    'billing_status', s.razorpay_status,
    'cancel_at_period_end', s.cancel_at_period_end,
    'banner_message', case
      when s.banner_message is not null
        and (s.banner_expires_at is null or s.banner_expires_at > now())
      then btrim(s.banner_message)
    end,
    'banner_expires_at', case
      when s.banner_message is not null
        and (s.banner_expires_at is null or s.banner_expires_at > now())
      then s.banner_expires_at
    end
  )
  into result
  from public.subscriptions s
  where s.user_id = uid;
  return result;
end;
$$;
revoke all on function public.get_my_subscription() from public, anon;
grant execute on function public.get_my_subscription() to authenticated;
