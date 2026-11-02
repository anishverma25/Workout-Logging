import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Trophy, UsersRound, X } from 'lucide-react';
import { getMyGroups, useRemote } from '@/app/community';
import { Section, TextButton } from '@/components/kit';

const PROMO_HIDDEN_KEY = 'overload.groupsPromoHidden';

/**
 * Groups on Home (November 2026): your place this week in your first group, or a quiet invite
 * to start one. Says nothing at all when the server cannot be reached, so Home never waits on it.
 */
export function GroupsHomeCard() {
  const groups = useRemote(getMyGroups, 'home');
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(PROMO_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!groups.data) return null;

  if (groups.data.length === 0) {
    if (hidden) return null;
    return (
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
    );
  }

  const g = groups.data[0]!;
  const line =
    g.rank === 1 && g.members > 1
      ? 'You lead this week'
      : g.above && g.behindBy !== null
        ? g.behindBy === 0
          ? `Level with @${g.above}`
          : `${g.behindBy} ${g.behindBy === 1 ? 'point' : 'points'} behind @${g.above}`
        : `${g.score} ${g.score === 1 ? 'point' : 'points'} this week`;
  return (
    <Section
      title="Groups"
      id="home-groups"
      action={
        groups.data.length > 1 ? (
          <TextButton small to="/groups">
            See all
          </TextButton>
        ) : null
      }
    >
      <Link
        to={`/groups/${g.id}`}
        className="pressable chrome flex items-center gap-3 rounded-card bg-surface p-4"
        data-home-group={g.name}
      >
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-dim text-gold"
        >
          <Trophy className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-headline block truncate text-text-1">
            {g.name}
            {g.rank ? <span className="tabular text-text-2"> · #{g.rank}</span> : null}
          </span>
          <span className="type-subhead tabular block truncate text-text-2">{line}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
      </Link>
    </Section>
  );
}
