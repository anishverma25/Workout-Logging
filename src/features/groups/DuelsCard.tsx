import { useEffect, useState } from 'react';
import { Link } from 'react-router';
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
  // The challenge moment: shown once a challenge is sent.
  const [stage, setStage] = useState<{ me: string; them: string } | null>(null);
  const meName = rows.find((r) => r.me)?.username ?? 'you';
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
      setStage({ me: meName, them: username });
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
      {live
        .filter((d) => d.mine && d.status === 'live')
        .map((d) => (
          <DuelArena key={d.id} duel={d} endsOn={data.endsOn} onForfeit={() => setGiveUp(d)} />
        ))}
      <div
        className={cn(
          'rounded-card bg-surface px-4',
          live.length > 0 &&
            live.every((d) => d.mine && d.status === 'live') &&
            last.length === 0 &&
            'hidden',
        )}
      >
        {live.length === 0 && last.length === 0 ? (
          <p className="type-subhead flex items-center gap-2.5 py-4 text-text-2">
            <Swords className="size-5 shrink-0 text-text-2" aria-hidden />
            Challenge a member: once they accept, most points by Sunday wins.
          </p>
        ) : (
          <ul className="divide-y-[0.5px] divide-divider">
            {[...live.filter((d) => !(d.mine && d.status === 'live')), ...last].map((d) => (
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
      {last.some((d) => d.mine) ? <DuelRecord duels={last} /> : null}
      {stage ? <DuelStage me={stage.me} them={stage.them} onDone={() => setStage(null)} /> : null}
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

/** Time left until the end of Sunday, the day the duel's week ends. */
function timeLeft(endsOn: string, now: Date): string {
  const end = new Date(`${endsOn}T23:59:59`);
  const ms = end.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'Ends today';
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return d > 0 ? `Ends Sun · ${d}d ${h % 24}h` : `Ends tonight · ${h}h`;
}

/**
 * Your running duel as an arena: you in lime on the left, your rival in red, the score as a
 * tug of war, how far apart you are and what earns points before Sunday.
 */
function DuelArena({
  duel: d,
  endsOn,
  onForfeit,
}: {
  duel: Duel;
  endsOn: string;
  onForfeit: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const mine = d.iAmChallenger ? d.challengerScore : d.opponentScore;
  const theirs = d.iAmChallenger ? d.opponentScore : d.challengerScore;
  const rival = d.iAmChallenger ? d.opponent : d.challenger;
  const me = d.iAmChallenger ? d.challenger : d.opponent;
  const share = mine + theirs === 0 ? 0.5 : mine / (mine + theirs);
  const gap = Math.abs(mine - theirs);
  const status = gap === 0 ? 'Level' : mine > theirs ? `You lead by ${gap}` : `You trail by ${gap}`;
  return (
    <article
      className="duel-card mb-3"
      data-duel="live"
      data-duel-mine
      aria-label={`Duel with @${rival}: ${status}, ${mine} to ${theirs}`}
    >
      <div className="type-caption flex items-center justify-between px-4 pt-3 pb-2 font-semibold text-text-2">
        <span className="duel-live">Live</span>
        <span className="tabular">{timeLeft(endsOn, now)}</span>
      </div>
      <div className="duel-arena">
        <div className="duel-fighter" data-side="me">
          <span className="duel-face" aria-hidden>
            {me.slice(0, 1).toUpperCase()}
          </span>
          <span className="type-footnote w-full truncate text-center font-semibold text-text-1">
            You
          </span>
          <span className="duel-score tabular" data-duel-score="me">
            {mine}
          </span>
        </div>
        <span className="duel-vs" aria-hidden>
          VS
        </span>
        <div className="duel-fighter" data-side="them">
          <span className="duel-face" aria-hidden>
            {rival.slice(0, 1).toUpperCase()}
          </span>
          <span className="type-footnote w-full truncate text-center font-semibold text-text-1">
            @{rival}
          </span>
          <span className="duel-score tabular" data-duel-score="them">
            {theirs}
          </span>
        </div>
      </div>
      <div className="duel-tug" aria-hidden>
        <span style={{ width: `${share * 100}%` }} />
      </div>
      <p
        className={cn(
          'type-subhead flex justify-between gap-3 px-4 pt-3 font-semibold',
          mine < theirs ? 'text-rival' : 'text-lime',
        )}
      >
        <span>{status}</span>
        <span className="font-normal text-text-2">A workout is +10</span>
      </p>
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-3">
        <span className="type-caption rounded-full bg-lime-dim px-2.5 py-1.5 font-semibold text-lime">
          +10 Train today
        </span>
        <span className="type-caption rounded-full bg-fill px-2.5 py-1.5 font-semibold text-text-1">
          +1 each hard set
        </span>
        <span className="type-caption rounded-full bg-fill px-2.5 py-1.5 font-semibold text-text-1">
          +3 Hit your protein
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t-[0.5px] border-divider px-4 py-3">
        <TextButton onClick={onForfeit} data-duel-forfeit>
          Give up
        </TextButton>
        <Link
          to="/workout"
          className="pressable type-headline inline-flex h-9 items-center rounded-full bg-lime px-4 text-on-lime"
        >
          Start workout
        </Link>
      </div>
    </article>
  );
}

/** Your duels of the last four weeks, won, lost and tied. */
function DuelRecord({ duels }: { duels: Duel[] }) {
  const mine = duels.filter((d) => d.mine && d.status === 'settled');
  const won = mine.filter(
    (d) => d.winner && d.winner === (d.iAmChallenger ? d.challenger : d.opponent),
  ).length;
  const tied = mine.filter((d) => d.winner === null).length;
  const lost = mine.length - won - tied;
  const cells = [
    { n: won, label: 'Won' },
    { n: lost, label: 'Lost' },
    { n: tied, label: 'Tied' },
  ];
  return (
    <dl
      className="mt-3 grid grid-cols-3 gap-2"
      aria-label="Your duels, last four weeks"
      data-duel-record
    >
      {cells.map((c) => (
        <div key={c.label} className="rounded-card bg-surface p-3 text-center">
          <dd className="type-title tabular text-text-1">{c.n}</dd>
          <dt className="type-caption text-text-2">{c.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** The moment a challenge is sent: two sides slide in, VS slams down, a flash. Tap to close. */
function DuelStage({ me, them, onDone }: { me: string; them: string; onDone: () => void }) {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(onDone, reduce ? 1200 : 2400);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="duel-stage"
      role="status"
      aria-label={`Challenge sent to @${them}`}
      onClick={onDone}
      data-duel-stage
    >
      <span className="duel-stage-l" aria-hidden />
      <span className="duel-stage-r" aria-hidden />
      <span className="duel-stage-p1" aria-hidden>
        <span className="duel-face size-20 text-3xl text-lime shadow-[0_0_0_3px_var(--lime),0_0_40px_var(--pro-glow)]">
          {me.slice(0, 1).toUpperCase()}
        </span>
        <span className="type-headline text-text-1">@{me}</span>
      </span>
      <span className="duel-stage-p2" aria-hidden>
        <span className="duel-face size-20 text-3xl text-rival shadow-[0_0_0_3px_var(--rival),0_0_40px_var(--rival-glow)]">
          {them.slice(0, 1).toUpperCase()}
        </span>
        <span className="type-headline text-text-1">@{them}</span>
      </span>
      <span className="duel-stage-vs" aria-hidden>
        VS
      </span>
      <span className="duel-stage-flash" aria-hidden />
      <span className="duel-stage-cap">
        <span className="type-title block text-text-1">Challenge sent</span>
        <span className="type-subhead text-text-2">Most points by Sunday wins</span>
      </span>
    </div>
  );
}
