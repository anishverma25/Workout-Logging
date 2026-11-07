import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, Globe2, KeyRound, Plus, Trophy, UsersRound } from 'lucide-react';
import { useSyncStatus } from '@/app/account';
import {
  getMyGroups,
  getMyStanding,
  getMyUsername,
  POINTS,
  useRemote,
  WEEKLY_CAPS,
  type MyGroup,
} from '@/app/community';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  BottomSheet,
  InlineNotice,
  PrimaryButton,
  SecondaryButton,
  Section,
  Skeleton,
  TextButton,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { CreateGroupSheet, JoinGroupSheet, UsernameForm } from './parts';

/**
 * Groups (November 2026): your username, the groups you are in with your place this week, and
 * creating or joining one by code. Boards live on each group's page.
 */
export function GroupsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const username = useRemote(getMyUsername, `u${version}`);
  const groups = useRemote(username.data ? getMyGroups : null, `g${version}:${username.data}`);
  const [sheet, setSheet] = useState<'create' | 'join' | 'username' | null>(null);
  const sync = useSyncStatus();
  const unsynced = sync.pending - sync.rejected;

  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="Groups"
        subtitle="Train with friends and compete on fair, weekly leaderboards."
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10" data-groups-page>
        <GlobalCard />

        {username.loading ? <Skeleton height="8rem" radius="panel" /> : null}

        {username.error ? (
          <InlineNotice tone="warning">
            {username.error}{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setVersion((v) => v + 1)}
            >
              Try again
            </button>
          </InlineNotice>
        ) : null}

        {username.data === null ? (
          <section
            className="rounded-panel bg-surface px-5 pb-6 pt-6"
            aria-labelledby="pick-username"
            data-pick-username
          >
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-lime-dim text-lime"
            >
              <UsersRound className="size-6" />
            </span>
            <h2 id="pick-username" className="type-title-2 mt-3 text-text-1">
              First, pick a username
            </h2>
            <p className="type-body mt-1 mb-4 text-text-2">
              Friends see your username, photo and points on leaderboards. Never your weights, food,
              body weight or workouts.
            </p>
            <UsernameForm
              submitLabel="Continue"
              onSaved={(name) => {
                toast(`You are @${name}`);
                setVersion((v) => v + 1);
              }}
            />
          </section>
        ) : null}

        {username.data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="type-body text-text-2">
                You are{' '}
                <span className="font-semibold text-text-1" data-my-username>
                  @{username.data}
                </span>
              </p>
              <TextButton small onClick={() => setSheet('username')}>
                Change
              </TextButton>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PrimaryButton
                block
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => setSheet('create')}
                data-open-create-group
              >
                Create a group
              </PrimaryButton>
              <SecondaryButton
                block
                icon={<KeyRound className="size-4" aria-hidden />}
                onClick={() => setSheet('join')}
                data-open-join-group
              >
                Join with a code
              </SecondaryButton>
            </div>

            {unsynced > 0 ? (
              <InlineNotice>
                Some of your changes have not reached your account yet. Workouts count on
                leaderboards once they sync, which happens by itself when you are online.
              </InlineNotice>
            ) : null}

            <Section title="Your groups" id="your-groups">
              {groups.loading ? <Skeleton height="5rem" radius="panel" /> : null}
              {groups.error ? (
                <InlineNotice tone="warning">
                  {groups.error}{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => setVersion((v) => v + 1)}
                  >
                    Try again
                  </button>
                </InlineNotice>
              ) : null}
              {groups.data && groups.data.length === 0 ? (
                <div className="rounded-card bg-surface px-5 py-6 text-center" data-no-groups>
                  <Trophy className="mx-auto size-8 text-lime" aria-hidden />
                  <p className="type-headline mt-2 text-text-1">No groups yet</p>
                  <p className="type-meta mx-auto mt-1 max-w-[36ch] text-text-2">
                    Create one for your gym friends and share the code, or join theirs with the code
                    they send you.
                  </p>
                </div>
              ) : null}
              {groups.data && groups.data.length > 0 ? (
                <ul className="flex flex-col gap-3" data-group-list>
                  {groups.data.map((g) => (
                    <li key={g.id}>
                      <GroupRow group={g} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>
          </>
        ) : null}

        <HowPointsWork />
      </div>

      <CreateGroupSheet
        open={sheet === 'create'}
        onClose={() => setSheet(null)}
        onCreated={(g) => {
          setSheet(null);
          navigate(`/groups/${g.id}?new=1`);
        }}
      />
      <JoinGroupSheet
        open={sheet === 'join'}
        onClose={() => setSheet(null)}
        onJoined={(g) => {
          setSheet(null);
          toast(g.already ? `You are already in ${g.name}` : `You joined ${g.name}`);
          navigate(`/groups/${g.id}`);
        }}
      />
      <BottomSheet
        open={sheet === 'username'}
        onClose={() => setSheet(null)}
        title="Change your username"
      >
        {sheet === 'username' ? (
          <UsernameForm
            initial={username.data}
            onSaved={(name) => {
              setSheet(null);
              toast(`You are now @${name}`);
              setVersion((v) => v + 1);
            }}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}

/** Everyone on Macrotrophy: the caller's place this week, linking to the full board. */
function GlobalCard() {
  const standing = useRemote(getMyStanding, 'standing');
  const s = standing.data;
  return (
    <Link
      to="/groups/global"
      className="pressable chrome flex items-center gap-3 rounded-panel bg-surface p-4"
      data-global-card
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
      >
        <Globe2 className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-text-1">Global leaderboard</span>
        <span className="type-subhead tabular block text-text-2">
          {s?.rank
            ? `You are #${s.rank} of ${s.total} on Macrotrophy this week`
            : 'Everyone on Macrotrophy, weekly and monthly'}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}

function GroupRow({ group: g }: { group: MyGroup }) {
  return (
    <Link
      to={`/groups/${g.id}`}
      className="pressable chrome flex items-center gap-3 rounded-card bg-surface p-4"
      data-group-row={g.name}
    >
      <span
        aria-hidden
        className="type-headline tabular flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
      >
        {g.rank ? `#${g.rank}` : '–'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-headline block truncate text-text-1">{g.name}</span>
        <span className="type-subhead tabular block text-text-2">
          {g.members} {g.members === 1 ? 'member' : 'members'} · {g.score}{' '}
          {g.score === 1 ? 'point' : 'points'} this week
        </span>
        {g.rank === 1 && g.members > 1 ? (
          <span className="type-caption block text-lime">You lead this week</span>
        ) : g.above && g.behindBy !== null ? (
          <span className="type-caption tabular block text-text-2">
            {g.behindBy === 0
              ? `Level on points with @${g.above}`
              : `${g.behindBy} ${g.behindBy === 1 ? 'point' : 'points'} behind @${g.above}`}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}

/** The scoring in one place, linking to the full method on the science page. */
export function HowPointsWork() {
  const items = [
    {
      points: POINTS.workout,
      what: 'a workout',
      detail: `10 minutes or more, with at least 3 working sets. Up to ${WEEKLY_CAPS.workouts} a week, 2 a day.`,
    },
    {
      points: POINTS.hardSet,
      what: 'a hard set',
      detail: `A working set close to failure. Warm-ups and easy sets (5+ reps left) do not count. Up to ${WEEKLY_CAPS.hardSets} a week.`,
    },
    {
      points: POINTS.record,
      what: 'a personal record',
      detail: `A new best on an exercise you have done at least twice before. Up to ${WEEKLY_CAPS.records} a week.`,
    },
    {
      points: POINTS.proteinDay,
      what: 'a protein day',
      detail: 'A day your logged protein reaches 90% of your own target.',
    },
  ];
  return (
    <Section
      title="How points work"
      id="how-points-work"
      action={
        <TextButton small to="/science#leaderboards">
          The science
        </TextButton>
      }
      footer="Everyone is measured against themselves, so a beginner can beat a strong lifter by showing up and pushing hard. Weeks run Monday to Sunday, India time."
    >
      <ul
        className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4"
        data-points-rules
      >
        {items.map((i) => (
          <li key={i.what} className="flex gap-3 py-3">
            <span className="type-headline tabular flex h-8 min-w-12 shrink-0 items-center justify-center rounded-full bg-lime px-2 text-on-lime">
              +{i.points}
            </span>
            <span className="min-w-0">
              <span className="type-headline block text-text-1">For {i.what}</span>
              <span className="type-subhead block text-text-2">{i.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
