import { MedalIcon } from '@/features/medals/Medal';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  HardDrive,
  Medal,
  Minus,
  RefreshCw,
  Share,
  type LucideIcon,
} from 'lucide-react';
import { useAccount, useSyncStatus } from '@/app/account';
import { Card, IconTile, PrimaryButton, TextLink } from '@/components/kit';
import { ShareSheet } from '@/features/share/ShareSheet';
import { RestCard } from '@/features/shared/RestCard';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { describeSync, type SyncTone } from '@/data/sync/describe';
import { milestones } from '@/domain/analytics/milestones';
import { formatRecordValue, PR_LABELS, type PersonalRecord } from '@/domain/analytics/prs';
import { buildSessions } from '@/domain/analytics/sessions';
import { summarizeWorkout, type ExerciseChange } from '@/domain/workout/summary';
import { FeedbackPrompt } from '@/features/feedback/FeedbackPrompt';
import { DurationValue, StatItem } from '@/features/history/StatItem';
import { cn } from '@/lib/cn';
import { formatDayMonth, formatLongDay, formatRelativeDayInline } from '@/lib/dates';
import { formatCompact, formatDurationMinutes, formatSignedPercent, pluralize } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { formatWeight, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { useNow } from '@/lib/useNow';

/** Shown right after finishing. Only metrics with real meaning; nothing padded in. */
export function SummaryPage() {
  const { workoutId } = useParams();
  const training = useTrainingData();
  const prefs = usePreferences();
  const unit = prefs.weightUnit;
  const summary = useMemo(
    () => (training.data && workoutId ? summarizeWorkout(training.data, workoutId) : null),
    [training.data, workoutId],
  );
  // Milestones this workout reached: counted over all history up to and including it.
  const reached = useMemo(() => {
    if (!training.data || !workoutId) return [];
    return milestones(
      buildSessions(training.data),
      training.data.bodyWeights,
      new Date(),
      prefs.weekStartsOn,
      training.data.profile?.trainingDays ?? null,
    ).filter((m) => m.workoutId === workoutId);
  }, [training.data, workoutId, prefs.weekStartsOn]);

  const [sharing, setSharing] = useState(false);

  if (training.status === 'loading') return <Skeleton className="mt-10 h-96" />;
  if (training.status === 'error') return <ErrorState error={training.error} />;
  if (!summary) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 pt-10">
        <ErrorState title="That workout was not found" />
        <ButtonLink to="/history" size="lg" variant="secondary">
          Go to history
        </ButtonLink>
      </div>
    );
  }
  const { session } = summary;
  const volumeChange = summary.volumeVsLast?.change ?? 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="chrome pt-[calc(1rem+env(safe-area-inset-top))] pb-6 lg:pt-8">
        <p className="type-meta text-text-2">
          {formatLongDay(session.date)}
          {summary.minutes !== null
            ? ` · ${summary.minutes < 1 ? '<1 min' : formatDurationMinutes(summary.minutes)}`
            : ''}
        </p>
        <h1 className="type-display mt-1 text-text-1">{session.workout.name} done</h1>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        <StatItem
          label="Duration"
          value={summary.minutes !== null ? <DurationValue minutes={summary.minutes} /> : null}
          empty={summary.minutes === null ? 'Not recorded' : undefined}
        />
        <StatItem label="Working sets" value={String(summary.workingSets)} />
        <StatItem
          label="Volume load"
          value={formatCompact(toDisplayWeight(summary.volumeKg, unit))}
          unit={unit}
          empty={summary.volumeKg > 0 ? undefined : 'None'}
        />
        <StatItem label="Exercises" value={String(summary.exercises.length)} />
      </dl>
      {summary.volumeVsLast ? (
        <p className="type-meta mt-3 flex items-start gap-1.5 text-text-2">
          <TrendIcon change={volumeChange} className="mt-px" />
          <span>
            Volume load <span className="tabular">{formatSignedPercent(volumeChange)}</span> vs your
            last {session.workout.name} on {formatDayMonth(summary.volumeVsLast.previousDate)}.
          </span>
        </p>
      ) : null}

      <PrimaryButton
        block
        icon={<Share aria-hidden />}
        onClick={() => setSharing(true)}
        className="mt-5"
      >
        {summary.prs.length > 0 ? 'Share your PR' : 'Share to your story'}
      </PrimaryButton>
      <ShareSheet workoutId={session.workout.id} open={sharing} onClose={() => setSharing(false)} />

      {summary.prs.length > 0 ? <RecordsCard prs={summary.prs} unit={unit} /> : null}

      {reached.length > 0 ? (
        <section
          aria-label="Milestones reached"
          className="mt-4 rounded-panel border border-border bg-surface p-5"
        >
          <div className="flex items-center gap-3">
            <IconTile icon={<Medal />} />
            <p className="type-headline text-text-1">
              {reached.length === 1 ? 'Milestone' : `${reached.length} milestones`}
            </p>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {reached.map((m) => (
              <li key={m.id}>
                <p className="type-title text-text-1">{m.title}</p>
                <p className="type-meta mt-0.5 text-text-2">{m.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Card as="section" aria-labelledby="summary-exercises" className="mt-4">
        <h2 id="summary-exercises" className="type-title text-text-1">
          Exercises
        </h2>
        <ul className="mt-2 divide-y-[0.5px] divide-divider">
          {summary.exercises.map((e) => (
            <li key={e.exerciseId} className="flex min-h-14 flex-col justify-center py-3">
              <span className="type-headline truncate text-text-1">{e.name}</span>
              <span className="type-meta tabular mt-0.5 text-text-2">
                {pluralize(e.workingSets, 'working set')}
                {e.volumeKg > 0
                  ? ` · ${formatCompact(toDisplayWeight(e.volumeKg, unit))} ${unit}`
                  : ''}
              </span>
              <ChangeLine change={e.change} unit={unit} />
            </li>
          ))}
        </ul>
        <p className="type-meta mt-2 text-text-2">
          Changes compare your best set with the last time you did each exercise: estimated 1RM for
          compound lifts, top load for isolation lifts, most reps for bodyweight ones.
        </p>
      </Card>

      <RestCard exercises={session.exercises} minutes={summary.minutes} className="mt-4" />

      {session.workout.notes ? (
        <Card as="section" aria-labelledby="summary-notes" className="mt-4">
          <h2 id="summary-notes" className="type-title text-text-1">
            Notes
          </h2>
          <p className="type-body mt-3 rounded-nested bg-surface-2 px-4 py-3 whitespace-pre-line text-text-2">
            {session.workout.notes}
          </p>
        </Card>
      ) : null}

      <FeedbackPrompt
        finishedWorkouts={
          training.data.workouts.filter(
            (w) => w.deletedAt === null && w.origin === 'user' && w.status === 'completed',
          ).length
        }
      />

      <div className="mt-4 flex justify-center">
        <TextLink to={`/history/${session.workout.id}`} chevron>
          View workout details
        </TextLink>
      </div>
      <SummarySync className="mt-2 justify-center" />

      {/* Pinned above the tab bar on phones and at the bottom of the window on desktop. */}
      <div className="sticky bottom-[calc(49px+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 bg-bg px-4 pt-3 pb-3 tab:-mx-6 tab:px-6 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-6">
        <ButtonLink to="/" size="lg" block>
          Done
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * New records: lime-dim card, lime trophy tile. Fades and scales in from 0.96 over 400 ms, then
 * a success haptic once. Reduced motion: shown at once, the haptic still fires.
 */
function RecordsCard({ prs, unit }: { prs: PersonalRecord[]; unit: WeightUnit }) {
  const ref = useRef<HTMLElement>(null);
  const buzzed = useRef(false);

  useEffect(() => {
    const buzz = () => {
      if (buzzed.current) return;
      buzzed.current = true;
      haptic('success');
    };
    const el = ref.current;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduced || typeof el.animate !== 'function') {
      buzz();
      return;
    }
    const animation = el.animate(
      [
        { opacity: 0, transform: 'scale(0.96)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 400, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' },
    );
    animation.finished.then(buzz).catch(() => {
      // Cancelled on unmount: no haptic for a card nobody saw.
    });
    return () => animation.cancel();
  }, []);

  return (
    <section
      ref={ref}
      aria-labelledby="summary-records"
      className="mt-4 rounded-panel border border-gold/30 bg-gold-dim p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-black/30">
          <MedalIcon className="size-7" />
        </span>
        <h2 id="summary-records" className="type-title text-text-1">
          {pluralize(prs.length, 'medal')} this workout
        </h2>
      </div>
      <ul className="mt-3 divide-y-[0.5px] divide-divider">
        {prs.map((pr) => (
          <li key={pr.id} className="flex items-start justify-between gap-3 py-3">
            <span className="flex min-w-0 items-start gap-2.5">
              <MedalIcon className="mt-0.5 size-5" />
              <span className="min-w-0">
                <span className="type-headline block truncate text-text-1">{pr.exerciseName}</span>
                <span className="type-meta mt-0.5 block text-text-2">{PR_LABELS[pr.type]}</span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="type-headline tabular block text-text-1">
                {formatRecordValue(pr.type, pr.value, unit)}
              </span>
              <span className="type-meta tabular mt-0.5 block text-text-2">
                was {formatRecordValue(pr.type, pr.previousBest, unit)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {prs.some((p) => p.type === 'e1rm') ? (
        <p className="type-meta mt-2 text-text-2">
          Estimated 1RM is the most you could likely lift once, worked out from the weight and reps
          of your sets. It is an estimate, not a lift you did.
        </p>
      ) : null}
    </section>
  );
}

function TrendIcon({ change, className }: { change: number; className?: string }) {
  const Icon = change > 0.0005 ? ArrowUpRight : change < -0.0005 ? ArrowDownRight : Minus;
  return <Icon className={cn('size-4 shrink-0 text-text-2', className)} aria-hidden />;
}

/** "+3.1% · e1RM 82.5 kg, vs earlier today" in Meta --text-2 with a neutral trend icon. */
function ChangeLine({ change, unit }: { change: ExerciseChange | null; unit: WeightUnit }) {
  if (!change) return null;
  if (change.kind === 'first') {
    return <span className="type-meta mt-0.5 text-text-2">First time</span>;
  }
  const same = Math.abs(change.change) < 0.0005;
  const detail =
    change.kind === 'e1rm'
      ? `e1RM ${formatWeight(change.today, unit)}`
      : change.kind === 'load'
        ? `top load ${formatWeight(change.today, unit)}`
        : `${change.today} reps`;
  return (
    <span className="type-meta mt-0.5 flex items-start gap-1.5 text-text-2">
      <TrendIcon change={change.change} className="mt-px" />
      <span className="tabular">
        {same ? 'Same as last time' : formatSignedPercent(change.change, 1)} · {detail}, vs{' '}
        {formatRelativeDayInline(change.previousDate)
          .replace(/^on /, '')
          .replace(/^today$/, 'earlier today')}
      </span>
    </span>
  );
}

const SYNC_ICON: Record<SyncTone, LucideIcon> = {
  local: HardDrive,
  pending: RefreshCw,
  synced: Check,
  problem: AlertTriangle,
};

/**
 * Where this workout is now, in the words of describeSync. The kit SyncStatus look (neutral
 * icon, Meta --text-2, warning icon only for a problem), with the "Sync status" name the
 * account page and tests use.
 */
function SummarySync({ className }: { className?: string }) {
  const account = useAccount();
  const sync = useSyncStatus();
  const now = useNow(30_000);
  const signedIn = account.status === 'signedIn';
  const description = describeSync(sync, signedIn, now);
  const Icon = SYNC_ICON[description.tone];
  return (
    <div
      role="status"
      aria-label="Sync status"
      className={cn('flex flex-wrap items-center gap-x-2', className)}
    >
      <Icon
        className={cn(
          'size-4 shrink-0',
          description.tone === 'problem' ? 'text-warning' : 'text-text-2',
        )}
        aria-hidden
      />
      <span className="type-meta text-text-2">
        {signedIn ? description.title : 'Saved on this device only.'}
      </span>
      {account.status === 'unavailable' || account.status === 'loading' ? null : (
        <Link
          to={signedIn ? '/account' : '/sign-in?next=/account'}
          className="pressable tap-target type-meta rounded-tile font-medium text-text-1 underline-offset-4 hover:underline"
        >
          {signedIn ? 'Details' : 'Back it up'}
        </Link>
      )}
    </div>
  );
}
