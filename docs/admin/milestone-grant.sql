-- Milestone users: Pro until one month after they signed up (the 7-day trial is inside that
-- month, not on top of it), plus a thank you message on their Home screen until it ends.
--
-- Run in the Supabase SQL editor. It should say "2 rows affected". A lower number means an email
-- did not match, the person already pays for Pro (billing_plan is set), or the month is over.
-- To change who gets what, edit the rows in the values list.

update public.subscriptions s
set status = 'active',
    pro_started_at = s.trial_started_at,
    pro_expires_at = s.trial_started_at + interval '30 days',
    banner_message = g.message,
    banner_expires_at = s.trial_started_at + interval '30 days',
    admin_note = concat_ws(e'\n', s.admin_note,
      to_char(now(), 'YYYY-MM-DD') || ': ' || g.note)
from auth.users u
join (values
  ('gotanks619@gmail.com',
   'Thank you for being our 100th user. We are giving you one month of Pro free.',
   'milestone: 100th user, Pro for one month from sign-up'),
  ('aritrabanerjee841@gmail.com',
   'Thank you for being our 101st user. We are giving you one month of Pro free.',
   'milestone: 101st user, Pro for one month from sign-up')
) as g(email, message, note) on lower(u.email) = lower(g.email)
where s.user_id = u.id
  and s.billing_plan is null
  and s.trial_started_at + interval '30 days' > now();
