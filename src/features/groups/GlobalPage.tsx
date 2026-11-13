import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Crown, Dumbbell, Globe2 } from 'lucide-react';
import { useSyncStatus } from '@/app/account';
import {
  CommunityError,
  getBoardRoutine,
  getGlobalBoard,
  scoreParts,
  setShareRoutine,
  setShowUsername,
  useRemote,
  type GlobalRow,
  type Period,
} from '@/app/community';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  CapsuleButton,
  InlineNotice,
  Section,
  SegmentedControl,
  Skeleton,
  Switch,
  TextButton,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { globalRankStory } from '@/domain/share/story';
import { RankShareSheet } from '@/features/share/RankShareSheet';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { BoardRoutineSheet } from './BoardRoutineSheet';
import { HowPointsWork } from './GroupsPage';
import { MemberAvatar } from './parts';

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const MEDAL = [
  'bg-gold-dim text-gold',
  'bg-[var(--fill)] text-[var(--tier-silver-1)]',
  'bg-[var(--fill)] text-[var(--tier-bronze-1)]',
];

/**
 * The global leaderboard (November 2026): everyone on Macrotrophy with points this week or month,
 * by Macrotrophy Score. Everyone appears under their profile name; a username shows only when its
 * owner turns it on here.
 */
export function GlobalPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState<0 | -1>(0);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const [routineOf, setRoutineOf] = useState<GlobalRow | null>(null);
  const [routineShown, setRoutineShown] = useState<boolean | null>(null);
  const [routineNotice, setRoutineNotice] = useState(() => {
    try {
      return localStorage.getItem(ROUTINE_NOTICE_KEY) !== 'seen';
    } catch {
      return false;
    }
  });
  const sync = useSyncStatus();
  const board = useRemote(
    () => getGlobalBoard(period, offset),
    `global:${period}:${offset}:${version}`,
  );
  const b = board.data ?? null;
  const showUsername = shown ?? b?.showUsername ?? false;
  const shareRoutine = routineShown ?? b?.shareRoutine ?? true;
  const podium = b && offset === 0 && b.rows.length >= 3 ? b.rows.slice(0, 3) : null;
  const listRows = b ? (podium ? b.rows.slice(3) : b.rows) : [];

  const dismissNotice = () => {
    setRoutineNotice(false);
    try {
      localStorage.setItem(ROUTINE_NOTICE_KEY, 'seen');
    } catch {
      // Storage blocked: the notice shows again next time.
    }
  };

  const toggleRoutine = async (next: boolean) => {
    setRoutineShown(next);
    dismissNotice();
    try {
      await setShareRoutine(next);
      toast(next ? 'Your routine plan shows on the boards' : 'Your routine is private now');
    } catch (err) {
      setRoutineShown(!next);
      toast(err instanceof CommunityError ? err.message : 'Could not save. Try again.');
    }
  };
  const periodName = period === 'week' ? 'week' : 'month';
  const which = offset === 0 ? `This ${periodName}` : `Last ${periodName}`;
  const mineInTop = !!b?.rows.some((r) => r.me);

  const toggle = async (next: boolean) => {
    setSaving(true);
    setShown(next);
    try {
      await setShowUsername(next);
      toast(
        next ? 'Your username now shows on the global leaderboard' : 'Only your name shows now',
      );
      setVersion((v) => v + 1);
    } catch (err) {
      setShown(!next);
      toast(err instanceof CommunityError ? err.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: '/groups', label: 'Groups' }}
        title="Global leaderboard"
        subtitle="Everyone on Macrotrophy, by the same fair Macrotrophy Score."
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10" data-global-page>
        {board.loading && !b ? <Skeleton height="16rem" radius="panel" /> : null}
        {board.error ? (
          <InlineNotice tone="warning">
            {board.error}{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setVersion((v) => v + 1)}
            >
              Try again
            </button>
          </InlineNotice>
        ) : null}

        {b ? (
          <>
            <div
              className="flex items-center gap-3 rounded-panel bg-lime-dim px-5 py-4"
              data-global-mine
            >
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime"
              >
                <Globe2 className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                {b.mine ? (
                  <>
                    <span className="type-headline tabular block text-text-1">
                      You are #{formatNumber(b.mine.rank)} of {formatNumber(b.total)}
                    </span>
                    <span className="type-subhead tabular block text-text-2">
                      {formatNumber(b.mine.score)} {b.mine.score === 1 ? 'point' : 'points'}{' '}
                      {offset === 0 ? `this ${periodName}` : `last ${periodName}`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="type-headline block text-text-1">
                      {offset === 0 ? 'Not on the board yet' : `No points last ${periodName}`}
                    </span>
                    <span className="type-subhead block text-text-2">
                      {offset === 0
                        ? 'Finish a workout of 10 minutes or more and you appear here.'
                        : `${formatNumber(b.total)} people scored.`}
                    </span>
                  </>
                )}
              </span>
              {b.mine ? (
                <CapsuleButton tone="lime" onClick={() => setSharing(true)} data-share-rank>
                  Share
                </CapsuleButton>
              ) : null}
            </div>

            {sync.pending - sync.rejected > 0 ? (
              <InlineNotice>
                Some of your changes have not reached your account yet. Your workouts count here
                once they sync.
              </InlineNotice>
            ) : null}

            <SegmentedControl<Period>
              label="Leaderboard period"
              block
              value={period}
              onChange={(p) => {
                setPeriod(p);
                setOffset(0);
                setOpen(null);
              }}
              options={[
                { value: 'week', label: 'Weekly' },
                { value: 'month', label: 'Monthly' },
              ]}
            />

            {routineNotice ? (
              <InlineNotice
                icon={<Dumbbell />}
                action={
                  <TextButton small onClick={dismissNotice}>
                    Got it
                  </TextButton>
                }
              >
                <span data-routine-notice>
                  New: tap anyone to see their routine and copy it. Yours shows too (the plan only,
                  never weights). You can hide it under Your privacy.
                </span>
              </InlineNotice>
            ) : null}

            {podium ? (
              <Podium
                rows={podium}
                onPick={(r) => setOpen((o) => (o === r.rank ? null : r.rank))}
              />
            ) : null}

            <Section
              title={`${which} · ${dateLabel(b.startsOn)} to ${dateLabel(b.endsOn)}`}
              id="global-board-title"
              action={
                <TextButton
                  small
                  onClick={() => {
                    setOffset((o) => (o === 0 ? -1 : 0));
                    setOpen(null);
                  }}
                  data-toggle-offset
                >
                  {offset === 0 ? `Last ${periodName}` : `This ${periodName}`}
                </TextButton>
              }
              footer={
                offset === 0
                  ? 'The top 100 by Macrotrophy Score. Updates every minute or so. Tap a name for their points and routine.'
                  : 'Final result, locked when it ended.'
              }
            >
              {b.rows.length === 0 ? (
                <p className="type-meta rounded-card bg-surface p-4 text-text-2">
                  No points yet this {periodName}. The first finished workout takes the lead.
                </p>
              ) : (
                <ol
                  className="divide-y-[0.5px] divide-divider overflow-hidden rounded-card bg-surface"
                  aria-labelledby="global-board-title"
                  data-global-board
                >
                  {(podium && open !== null && open <= 3
                    ? b.rows.slice(0, 3).filter((r) => r.rank === open)
                    : []
                  ).map((r) => (
                    <GlobalRowView
                      key={`p${r.rank}`}
                      row={r}
                      open
                      onToggle={() => setOpen(null)}
                      onRoutine={() => setRoutineOf(r)}
                    />
                  ))}
                  {listRows.map((r) => (
                    <GlobalRowView
                      key={r.rank}
                      row={r}
                      open={open === r.rank}
                      onToggle={() => setOpen((o) => (o === r.rank ? null : r.rank))}
                      onRoutine={() => setRoutineOf(r)}
                    />
                  ))}
                  {b.mine && !mineInTop ? (
                    <>
                      <li aria-hidden className="type-caption py-1 text-center text-text-3">
                        ···
                      </li>
                      <GlobalRowView
                        row={b.mine}
                        open={open === b.mine.rank}
                        onToggle={() => setOpen((o) => (o === b.mine!.rank ? null : b.mine!.rank))}
                        onRoutine={() => setRoutineOf(b.mine)}
                      />
                    </>
                  ) : null}
                </ol>
              )}
            </Section>

            <Section title="Your privacy" id="global-privacy-title">
              <div
                className="divide-y-[0.5px] divide-divider overflow-hidden rounded-card bg-surface"
                data-global-privacy
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span id="global-privacy" className="type-headline block text-text-1">
                      Show my username
                    </span>
                    <span className="type-subhead block text-text-2">
                      {b.hasUsername
                        ? 'Your name always shows. Turn this on to show your username next to it.'
                        : 'Your name shows here. Pick a username in Groups to show it too.'}
                    </span>
                    {!b.hasUsername ? (
                      <Link
                        to="/groups"
                        className="type-subhead mt-1 inline-block font-semibold text-lime"
                      >
                        Pick a username
                      </Link>
                    ) : null}
                  </span>
                  <Switch
                    checked={showUsername && b.hasUsername}
                    onChange={(next) => void toggle(next)}
                    disabled={!b.hasUsername || saving}
                    aria-labelledby="global-privacy"
                  />
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span id="routine-privacy" className="type-headline block text-text-1">
                      Show my routine plan
                    </span>
                    <span className="type-subhead block text-text-2">
                      People who tap you see your days, exercises, sets and reps. Never your
                      weights, food or body.
                    </span>
                  </span>
                  <Switch
                    checked={shareRoutine}
                    onChange={(next) => void toggleRoutine(next)}
                    aria-labelledby="routine-privacy"
                    data-share-routine-switch
                  />
                </div>
              </div>
            </Section>

            <HowPointsWork />
          </>
        ) : null}
      </div>
      <BoardRoutineSheet
        open={routineOf !== null}
        onClose={() => setRoutineOf(null)}
        owner={routineOf?.name ?? ''}
        load={() => getBoardRoutine(period, offset, routineOf!.rank)}
      />
      {b?.mine ? (
        <RankShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          fileTag={`rank-${period}`}
          load={async () => {
            const mine = b.mine;
            if (!mine) return null;
            // Movement only against a finished, frozen period.
            let previousRank: number | null = null;
            if (offset === 0) {
              const prev = await getGlobalBoard(period, -1).catch(() => null);
              if (prev?.locked && prev.mine) previousRank = prev.mine.rank;
            }
            return globalRankStory({
              period,
              startsOn: b.startsOn,
              endsOn: b.endsOn,
              rank: mine.rank,
              total: b.total,
              previousRank,
              score: mine.score,
              workouts: mine.workouts,
              hardSets: mine.hardSets,
              records: mine.records,
              proteinDays: mine.proteinDays,
            });
          }}
        />
      ) : null}
    </>
  );
}

const ROUTINE_NOTICE_KEY = 'overload.routineNotice';

/** The top three, side by side, first in the middle and raised. */
function Podium({ rows, onPick }: { rows: GlobalRow[]; onPick: (r: GlobalRow) => void }) {
  const order = [rows[1]!, rows[0]!, rows[2]!];
  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label="Top three" data-podium>
      {order.map((r) => {
        const first = r.rank === 1;
        return (
          <li key={r.rank} className={first ? 'order-none' : ''}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className={cn(
                'pressable relative flex w-full flex-col items-center gap-2 overflow-hidden rounded-card bg-surface px-2 text-center',
                first ? 'glow-lime pt-5 pb-4' : 'pt-4 pb-3',
              )}
              data-podium-rank={r.rank}
            >
              {first ? <Crown className="size-5 text-gold" aria-hidden /> : null}
              <span className={first ? 'scale-125' : ''}>
                <MemberAvatar username={r.name} avatar={r.avatar} />
              </span>
              <span className="type-subhead line-clamp-2 min-h-[2.5em] w-full break-words text-text-1">
                {r.name}
                {r.me ? <span className="block text-text-2">You</span> : null}
              </span>
              <span
                className={cn(
                  'type-caption tabular rounded-full px-2 py-0.5 font-semibold',
                  MEDAL[r.rank - 1],
                )}
              >
                #{r.rank} · {formatNumber(r.score)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function GlobalRowView({
  row: r,
  open,
  onToggle,
  onRoutine,
}: {
  row: GlobalRow;
  open: boolean;
  onToggle: () => void;
  onRoutine: () => void;
}) {
  return (
    <li className={cn(r.me && 'bg-lime-dim')} data-global-row={r.rank} data-me={r.me || undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'type-headline tabular flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-1',
            MEDAL[r.rank - 1] ?? 'text-text-2',
          )}
          aria-label={`Place ${r.rank}`}
        >
          {r.rank}
        </span>
        <MemberAvatar username={r.name} avatar={r.avatar} />
        <span className="min-w-0 flex-1">
          <span className="type-headline block truncate text-text-1">
            {r.name}
            {r.me ? <span className="type-subhead ml-1.5 text-text-2">You</span> : null}
          </span>
          {r.username ? (
            <span className="type-subhead block truncate text-text-2">@{r.username}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-right">
          <span className="type-headline tabular block text-text-1">{formatNumber(r.score)}</span>
          <span className="type-caption block text-text-2">
            {r.score === 1 ? 'point' : 'points'}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-text-3 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="px-4 pb-4" data-breakdown>
          <ul className="grid grid-cols-2 gap-2">
            {scoreParts(r).map((p) => (
              <li key={p.key} className="rounded-nested bg-surface-2 px-3 py-2">
                <span className="type-caption block text-text-2">{p.label}</span>
                <span className="type-headline tabular block text-text-1">
                  {p.count} <span className="type-caption text-text-2">= {p.points} pts</span>
                </span>
              </li>
            ))}
          </ul>
          {!r.me ? (
            <div className="mt-3">
              <TextButton onClick={onRoutine} data-see-routine>
                See their routine
              </TextButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
