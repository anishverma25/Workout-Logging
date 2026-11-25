# Community

Questions and journeys, replies, Helpful and Support, optional anonymity, photos, karma with a
30-day Pro reward, reports and blocks, and Macrotrophy Verified creators. Migration
`20261125000040_community_forum.sql`; app `src/app/forum.ts` and `src/features/community`;
owner SQL in `docs/community-owner-sql.md`.

## Where it lives

- Home: "Leaderboards & Community" (`GroupsHomeCard` with `CommunityHomeBanner`), also on an
  empty Home. More: one row "Leaderboards & Community" to `/community`. `/community` and
  `/groups` share one switch (`HubSwitch`).
- Pages: `/community` (compose bar, search, For you, Latest, Unanswered, topics), `/community/new`,
  `/community/p/:id` (thread; tab bar hidden, reply bar docked), `/community/activity`,
  `/community/mine`, `/community/karma`, `/community/u/:username`.
- Online only: nothing goes through the workout database or the sync outbox. Drafts of a post
  stay on the phone (`overload.community.draft.*`).

## Privacy

- Tables `forum_*` have row level security and no grants; members only call `forum_*`
  functions, which return a public author object: username, photo and verified mark, or an
  anonymous label scoped to the thread ("Anonymous Lifter 2"). Never the account id.
- Anonymous content never shows a username, photo, verified mark or profile link, never appears on
  a profile, and does not count in a profile's answers. Exact karma is shown only to its owner.
- Blocking from anonymous content hides that person's anonymous content only, so a block never
  reveals who they are. Someone else's content and missing content give the same "not found".
- Replies on your own anonymous post start anonymous.
- Photos are redrawn on the phone (EXIF and GPS dropped), checked again on the server, stored as
  JPEG data URLs and served only through `forum_post` and `forum_photo`. They use database space
  (about 0.2 to 0.4 MB each); `community_photos` turns new photos off.

## Karma

+5 Helpful on a reply, +20 Best Answer, +3 Helpful on a journey; Support and posting give 0.
Votes count only from confirmed accounts 3+ days old, at most 5 a day and 20 a month from one
member to another. Removing a vote, changing the best answer, deleting or removing content
reverse the points (append-only `forum_karma`). The reward rules are one row in
`forum_reward_rules` (defaults 300 karma in 180 days, 3 best answers, 15 members, 12 detailed
answers in 8 threads on 10 days, account 30 days old). One reward a year, claimed under a lock;
with live autopay it is held until the autopay ends (`forum_my_karma` applies it).

## Moderation

Reports go to `community_owner_pending_reports` (urgent first). An explicit-photo report from a
member of a week or more holds the photo; three reporters hold any item. Holding never bans. The
owner bans, mutes, hides, restores and verifies with `community_owner_*` (SQL editor only).

## Known limits

- No automatic image screening yet (reports and holds only).
- No owner email alert for urgent reports yet: check the queue daily.
- Under-18 accounts (by the profile birth date) are read-only.
