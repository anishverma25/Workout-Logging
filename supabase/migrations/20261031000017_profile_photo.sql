-- Round 5 (October 2026): a profile photo of the person's choice. The phone crops and shrinks it
-- to a 256 px JPEG (about 20 to 40 kB as a data URL) and syncs it with the profile row, so it
-- shows on every device signed in to the account. Safe to run more than once. Run it in the
-- SQL editor before the app version that needs it is deployed.

alter table public.profiles add column if not exists avatar text;
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (
    avatar is null
    or (length(avatar) <= 80000 and avatar ~ '^data:image/(jpeg|png|webp);base64,')
  );
