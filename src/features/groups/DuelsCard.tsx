import { useState } from 'react';
import { Swords, X } from 'lucide-react';
import {
  cancelDuel,
  CommunityError,
  createDuel,
  getDuels,
  useRemote,
  type BoardRow,
  type Duel,
} from '@/app/community';
import { BottomSheet, CapsuleButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

/**
 * Duels: challenge a member of the group for the week. The points are the group's own
 * weekly points, so there is nothing new to learn. Free accounts start one a week, Pro three. Hidden when the server does not have duels
 * yet, or there is nobody to challenge.
 */
export function DuelsCard({
  groupId,
  rows,
  version,
}: {
  groupId: string;
  rows: BoardRow[];
  version: number;
}) {
  const toast = useToast();
  const [own, setOwn] = useState(0);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const duels = useRemote(() => getDuels(groupId), `${groupId}:duels:${version}:${own}`);
  const data = duels.data;
  const others = rows.filter((r) => !r.me);
  if (!data || others.length === 0) return null;
  const live = data.duels.filter((d) => d.live);
  const last = data.duels.filter((d) => !d.live);
  const started = live.filter((d) => d.iAmChallenger).length;
  const taken = new Set(live.filter((d) => d.mine).flatMap((d) => [d.challenger, d.opponent]));
  const free = others.filter((r) => !taken.has(r.username));

  const challenge = async (username: string) => {
    setBusy(true);
    try {
      await createDuel(groupId, username);
      setPicking(false);
      setOwn((n) => n + 1);
      toast(`Duel on with @${username} for this week`);
    } catch (e) {
      toast(e instanceof CommunityError ? e.message : 'Could not start the duel. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (d: Duel) => {
    await cancelDuel(d.id).catch(() => false);
    setOwn((n) => n + 1);
  };

  return (
    <section aria-labelledby="duels-title" data-duels>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="duels-title" className="type-section text-text-1">
          Duels this week
        </h2>
        {free.length > 0 && started < data.limit ? (
          <CapsuleButton onClick={() => setPicking(true)} data-duel-start>
            Challenge
          </CapsuleButton>
        ) : free.length > 0 && data.limit < 3 ? (
          <CapsuleButton to="/pro" data-duel-more>
            More with Pro
          </CapsuleButton>
        ) : null}
      </div>
      <div className="rounded-card bg-surface px-4">
        {live.length === 0 && last.length === 0 ? (
          <p className="type-subhead flex items-center gap-2.5 py-4 text-text-2">
            <Swords className="size-5 shrink-0 text-text-2" aria-hidden />
            Challenge a member: most points by Sunday wins.
          </p>
        ) : (
          <ul className="divide-y-[0.5px] divide-divider">
            {[...live, ...last].map((d) => (
              <DuelRow
                key={d.id}
                duel={d}
                onCancel={d.live && d.mine ? () => void cancel(d) : undefined}
              />
            ))}
          </ul>
        )}
      </div>
      <BottomSheet
        open={picking}
        onClose={() => setPicking(false)}
        title="Challenge a member"
        subtitle="Most points this week wins"
      >
        {picking ? (
          <ul className="divide-y-[0.5px] divide-divider" data-duel-pick>
            {free.map((r) => (
              <li key={r.username}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void challenge(r.username)}
                  className="pressable flex w-full items-center justify-between gap-3 py-3.5 text-left"
                  data-duel-member={r.username}
                >
                  <span className="type-headline text-text-1">@{r.username}</span>
                  <span className="type-subhead tabular text-text-2">{r.score} pts this week</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </BottomSheet>
    </section>
  );
}

function DuelRow({ duel: d, onCancel }: { duel: Duel; onCancel?: () => void }) {
  const total = Math.max(1, d.challengerScore + d.opponentScore);
  const share = d.challengerScore + d.opponentScore === 0 ? 0.5 : d.challengerScore / total;
  const lead =
    d.challengerScore === d.opponentScore ? null : d.challengerScore > d.opponentScore ? 'c' : 'o';
  const meSide = d.mine ? (d.iAmChallenger ? 'c' : 'o') : null;
  const verdict = d.live
    ? lead === null
      ? 'Level'
      : meSide
        ? lead === meSide
          ? 'You lead'
          : 'You trail'
        : `@${lead === 'c' ? d.challenger : d.opponent} leads`
    : lead === null
      ? 'Last week: a tie'
      : meSide
        ? lead === meSide
          ? 'Last week: you won'
          : 'Last week: you lost'
        : `Last week: @${lead === 'c' ? d.challenger : d.opponent} won`;
  return (
    <li
      className="py-3.5"
      data-duel={d.live ? 'live' : 'done'}
      data-duel-mine={d.mine || undefined}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn('type-headline truncate', lead === 'c' ? 'text-text-1' : 'text-text-2')}
            >
              @{d.challenger}
            </span>
            <span className="type-headline tabular shrink-0 text-text-1">
              {d.challengerScore} <span className="text-text-2">:</span> {d.opponentScore}
            </span>
            <span
              className={cn(
                'type-headline truncate text-right',
                lead === 'o' ? 'text-text-1' : 'text-text-2',
              )}
            >
              @{d.opponent}
            </span>
          </div>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
            <span className="bg-lime" style={{ width: `${share * 100}%` }} />
          </div>
          <p className="type-footnote mt-1.5 text-text-2">{verdict}</p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Call off this duel"
            className="pressable tap-target flex size-9 shrink-0 items-center justify-center rounded-full text-text-2"
            data-duel-cancel
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}
