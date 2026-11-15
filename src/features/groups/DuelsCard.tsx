import { useState } from 'react';
import { Swords, X } from 'lucide-react';
import {
  acceptDuel,
  cancelDuel,
  CommunityError,
  createDuel,
  forfeitDuel,
  getDuels,
  useRemote,
  type BoardRow,
  type Duel,
} from '@/app/community';
import { BottomSheet, CapsuleButton, ConfirmSheet, TextButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

/**
 * Duels: challenge a member of the group for the week. The points are the group's own weekly
 * points, counted from the moment the other person accepts (migration 0036). Before that either
 * can call it off; after it only a forfeit ends it, as a loss. Free accounts start one a week,
 * Pro three, in all groups together. Hidden when the server does not have duels yet, or there
 * is nobody to challenge.
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
  const [giveUp, setGiveUp] = useState<Duel | null>(null);
  const duels = useRemote(() => getDuels(groupId), `${groupId}:duels:${version}:${own}`);
  const data = duels.data;
  const others = rows.filter((r) => !r.me);
  if (!data || others.length === 0) return null;
  const live = data.duels.filter((d) => d.live);
  const last = data.duels.filter((d) => !d.live);
  const started = data.started;
  // One duel per pair a week, finished ones included (the server refuses a second).
  const taken = new Set(
    data.duels
      .filter((d) => d.mine && (d.live || d.weekStart === data.weekStart))
      .flatMap((d) => [d.challenger, d.opponent]),
  );
  const free = others.filter((r) => !taken.has(r.username));

  const challenge = async (username: string) => {
    setBusy(true);
    try {
      await createDuel(groupId, username);
      setPicking(false);
      setOwn((n) => n + 1);
      toast(`Challenge sent to @${username}. It starts when they accept.`);
    } catch (e) {
      toast(e instanceof CommunityError ? e.message : 'Could not start the duel. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const act = async (run: () => Promise<boolean>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await run().catch(() => false);
      toast(ok ? done : 'That duel has changed. Showing the latest.');
    } finally {
      setBusy(false);
      setOwn((n) => n + 1);
    }
  };
  const cancel = (d: Duel) =>
    act(() => cancelDuel(d.id), d.iAmChallenger ? 'Challenge withdrawn' : 'Challenge declined');
  const accept = (d: Duel) =>
    act(() => acceptDuel(d.id), `Duel on with @${d.challenger}. Points count from now.`);
  const forfeit = async (d: Duel) => {
    await act(() => forfeitDuel(d.id), 'You gave up this duel');
    setGiveUp(null);
  };

  return (
    <section aria-labelledby="duels-title" data-duels>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="duels-title" className="type-section text-text-1">
          Duels
        </h2>
        {free.length > 0 && started < data.limit ? (
          <CapsuleButton onClick={() => setPicking(true)} data-duel-start>
            Challenge
          </CapsuleButton>
        ) : free.length > 0 && data.limit <= 1 ? (
          <CapsuleButton to="/pro" data-duel-more>
            More with Pro
          </CapsuleButton>
        ) : null}
      </div>
      <div className="rounded-card bg-surface px-4">
        {live.length === 0 && last.length === 0 ? (
          <p className="type-subhead flex items-center gap-2.5 py-4 text-text-2">
            <Swords className="size-5 shrink-0 text-text-2" aria-hidden />
            Challenge a member: once they accept, most points by Sunday wins.
          </p>
        ) : (
          <ul className="divide-y-[0.5px] divide-divider">
            {[...live, ...last].map((d) => (
              <DuelRow
                key={d.id}
                duel={d}
                busy={busy}
                onCancel={d.status === 'pending' && d.mine ? () => void cancel(d) : undefined}
                onAccept={
                  d.status === 'pending' && d.mine && !d.iAmChallenger
                    ? () => void accept(d)
                    : undefined
                }
                onForfeit={d.status === 'live' && d.mine ? () => setGiveUp(d) : undefined}
              />
            ))}
          </ul>
        )}
      </div>
      <BottomSheet
        open={picking}
        onClose={() => setPicking(false)}
        title="Challenge a member"
        subtitle="Points count from when they accept"
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
      <ConfirmSheet
        open={giveUp !== null}
        title="Give up this duel?"
        body="It counts as a loss for you this week. This cannot be undone."
        confirmLabel="Give up"
        cancelLabel="Keep going"
        destructive
        busy={busy}
        onConfirm={() => giveUp && void forfeit(giveUp)}
        onClose={() => setGiveUp(null)}
      />
    </section>
  );
}

function DuelRow({
  duel: d,
  busy,
  onCancel,
  onAccept,
  onForfeit,
}: {
  duel: Duel;
  busy: boolean;
  onCancel?: () => void;
  onAccept?: () => void;
  onForfeit?: () => void;
}) {
  const total = Math.max(1, d.challengerScore + d.opponentScore);
  const share = d.challengerScore + d.opponentScore === 0 ? 0.5 : d.challengerScore / total;
  const lead =
    d.challengerScore === d.opponentScore ? null : d.challengerScore > d.opponentScore ? 'c' : 'o';
  const meSide = d.mine ? (d.iAmChallenger ? 'c' : 'o') : null;
  const meName = meSide === 'c' ? d.challenger : meSide === 'o' ? d.opponent : null;
  const pending = d.status === 'pending';
  const settled = d.status === 'settled';
  const winnerSide = settled
    ? d.winner === null
      ? null
      : d.winner === d.challenger
        ? 'c'
        : 'o'
    : lead;
  const when = settled ? `Week of ${weekOf(d.weekStart)}: ` : '';
  const how = settled && d.forfeit ? ' (forfeit)' : '';
  const verdict = pending
    ? d.mine
      ? d.iAmChallenger
        ? `Waiting for @${d.opponent} to accept`
        : `@${d.challenger} challenged you`
      : `Waiting for @${d.opponent}`
    : !settled
      ? lead === null
        ? 'Level'
        : meSide
          ? lead === meSide
            ? 'You lead'
            : 'You trail'
          : `@${lead === 'c' ? d.challenger : d.opponent} leads`
      : winnerSide === null
        ? `${when}a tie`
        : meName
          ? d.winner === meName
            ? `${when}you won${how}`
            : `${when}you lost${how}`
          : `${when}@${d.winner} won${how}`;
  return (
    <li
      className="py-3.5"
      data-duel={pending ? 'pending' : settled ? 'done' : 'live'}
      data-duel-mine={d.mine || undefined}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'type-headline truncate',
                winnerSide === 'c' ? 'text-text-1' : 'text-text-2',
              )}
            >
              @{d.challenger}
            </span>
            {pending ? (
              <span className="type-footnote shrink-0 text-text-2">vs</span>
            ) : (
              <span className="type-headline tabular shrink-0 text-text-1">
                {d.challengerScore} <span className="text-text-2">:</span> {d.opponentScore}
              </span>
            )}
            <span
              className={cn(
                'type-headline truncate text-right',
                winnerSide === 'o' ? 'text-text-1' : 'text-text-2',
              )}
            >
              @{d.opponent}
            </span>
          </div>
          {pending ? null : (
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
              <span className="bg-lime" style={{ width: `${share * 100}%` }} />
            </div>
          )}
          <p className="type-footnote mt-1.5 text-text-2">{verdict}</p>
          {onAccept || onForfeit ? (
            <div className="mt-2 flex flex-wrap gap-4">
              {onAccept ? (
                <TextButton onClick={onAccept} data-duel-accept>
                  Accept
                </TextButton>
              ) : null}
              {onForfeit ? (
                <TextButton onClick={onForfeit} data-duel-forfeit>
                  Give up
                </TextButton>
              ) : null}
            </div>
          ) : null}
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={d.iAmChallenger ? 'Withdraw this challenge' : 'Decline this challenge'}
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekOf = (key: string) => {
  const [, m, day] = key.split('-').map(Number);
  return m && day ? `${day} ${MONTHS[m - 1]}` : key;
};
