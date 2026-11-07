import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Globe2, Trophy, UsersRound, X } from 'lucide-react';
import { getMyGroups, getMyStanding, useRemote } from '@/app/community';
import { Section, TextButton } from '@/components/kit';

const PROMO_HIDDEN_KEY = 'overload.groupsPromoHidden';

/**
 * Leaderboards on Home (November 2026): your place this week on the global board and in your
 * first group, or a quiet invite to start a group. Says nothing at all when the server cannot be
 * reached, so Home never waits on it.
 */
export function GroupsHomeCard() {
  const groups = useRemote(getMyGroups, 'home');
  const standing = useRemote(getMyStanding, 'home-standing');
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(PROMO_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const g = groups.data?.[0] ?? null;
  const s = standing.data?.rank ? standing.data : null;
  const promo = groups.data?.length === 0 && !hidden;
  if (!g && !s && !promo) return null;

  const groupLine = g
    ? g.rank === 1 && g.members > 1
      ? 'You lead this week'
      : g.above && g.behindBy !== null
        ? g.behindBy === 0
          ? `Level with @${g.above}`
          : `${g.behindBy} ${g.behindBy === 1 ? 'point' : 'points'} behind @${g.above}`
        : `${g.score} ${g.score === 1 ? 'point' : 'points'} this week`
    : '';

  return (
    <Section
      title="Leaderboards"
      id="home-leaderboards"
      action={
        <TextButton small to="/groups">
          See all
        </TextButton>
      }
    >
      <div className="flex flex-col gap-3">
        {s ? (
          <Row
            to="/groups/global"
            icon={<Globe2 className="size-5" />}
            tone="lime"
            title={`#${s.rank} of ${s.total} on Macrotrophy`}
            line={`${s.score} ${s.score === 1 ? 'point' : 'points'} this week`}
            data-home-global
          />
        ) : null}
        {g ? (
          <Row
            to={`/groups/${g.id}`}
            icon={<Trophy className="size-5" />}
            tone="gold"
            title={`${g.name}${g.rank ? ` · #${g.rank}` : ''}`}
            line={groupLine}
            data-home-group={g.name}
          />
        ) : null}
        {promo ? (
          <section
            className="relative flex items-center gap-3 rounded-card bg-surface p-4 pr-12"
            aria-labelledby="groups-promo-title"
            data-groups-promo
          >
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
            >
              <UsersRound className="size-5" />
            </span>
            <Link to="/groups" className="min-w-0 flex-1">
              <span id="groups-promo-title" className="type-headline block text-text-1">
                Compete with your gym friends
              </span>
              <span className="type-subhead block text-text-2">
                Create a group or join one with a code. Weekly leaderboards, fair for every level.
              </span>
            </Link>
            <button
              type="button"
              aria-label="Hide"
              className="pressable absolute top-2 right-2 flex size-8 items-center justify-center rounded-full text-text-3"
              onClick={() => {
                try {
                  localStorage.setItem(PROMO_HIDDEN_KEY, '1');
                } catch {
                  // Private mode: hidden for this visit only.
                }
                setHidden(true);
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          </section>
        ) : null}
      </div>
    </Section>
  );
}

function Row({
  to,
  icon,
  tone,
  title,
  line,
  ...data
}: {
  to: string;
  icon: ReactNode;
  tone: 'lime' | 'gold';
  title: string;
  line: string;
  [data: `data-${string}`]: unknown;
}) {
  return (
    <Link
      to={to}
      className="pressable chrome flex items-center gap-3 rounded-card bg-surface p-4"
      {...data}
    >
      <span
        aria-hidden
        className={
          tone === 'gold'
            ? 'flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-dim text-gold'
            : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime'
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-headline tabular block truncate text-text-1">{title}</span>
        <span className="type-subhead tabular block truncate text-text-2">{line}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}
