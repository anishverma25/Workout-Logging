import { Check, Moon, Play, Plus } from 'lucide-react';
import type { TodayPlan } from '@/domain/analytics/dashboard';
import { sessionDurationMinutes } from '@/domain/analytics/sessions';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useStartWorkout } from '@/features/workout/StartWorkout';
import { cn } from '@/lib/cn';
import { formatWeekday } from '@/lib/dates';
import {
  formatDateInSentence,
  formatDurationSummary,
  formatNumber,
  formatRepRange,
  pluralize,
} from '@/lib/format';
import { TextLink } from '@/components/kit';
import type { WeightUnit } from '@/lib/units';
import { toDisplayWeight } from '@/lib/units';

interface TodayCardProps {
  plan: TodayPlan;
  unit: WeightUnit;
  className?: string;
}

const MAX_LISTED = 4;

/** The next thing to do. Always the first card on Home. */
export function TodayCard({ plan, unit, className }: TodayCardProps) {
  return (
    <section
      aria-labelledby="today-title"
      className={cn('rounded-panel border border-border bg-surface p-5', className)}
    >
      <div>
        {plan.kind === 'planned' ? <Planned plan={plan} /> : null}
        {plan.kind === 'done' ? <Done plan={plan} unit={unit} /> : null}
        {plan.kind === 'rest' ? <Rest plan={plan} /> : null}
        {plan.kind === 'no_routine' ? <NoRoutine /> : null}
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="type-meta text-text-2">{children}</p>;
}

function Planned({ plan }: { plan: Extract<TodayPlan, { kind: 'planned' }> }) {
  const listed = plan.exercises.slice(0, MAX_LISTED);
  const more = plan.exercises.length - listed.length;
  const totalSets = plan.exercises.reduce((n, e) => n + e.sets, 0);
  return (
    <>
      <Eyebrow>Today in {plan.routineName}</Eyebrow>
      <h2 id="today-title" className="type-display mt-0.5 text-text-1">
        {plan.day.name}
      </h2>
      <dl className="type-meta mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <Meta label="Exercises" value={String(plan.exercises.length)} />
        <Meta label="Working sets" value={String(totalSets)} />
        {plan.estimatedMinutes ? (
          <Meta label="Last took" value={formatDurationSummary(plan.estimatedMinutes)} />
        ) : null}
      </dl>
      <ol className="mt-4 divide-y-[0.5px] divide-divider border-y-[0.5px] border-divider">
        {listed.map((e) => (
          <li key={e.id} className="flex min-h-11 items-center justify-between gap-4 py-2">
            <span className="type-body truncate font-medium text-text-1">{e.name}</span>
            <span className="type-meta tabular shrink-0 text-text-2">
              {e.sets} × {formatRepRange(e.repMin, e.repMax)}
            </span>
          </li>
        ))}
      </ol>
      {more > 0 ? (
        <p className="type-meta mt-2.5 text-text-2">and {pluralize(more, 'more exercise')}</p>
      ) : null}
      {plan.lastSession ? (
        <p className="type-meta mt-1 text-text-2">
          Last done {formatDateInSentence(plan.lastSession.date)}
        </p>
      ) : null}
      <StartButton dayId={plan.day.id} label={`Start ${plan.day.name}`} />
      {plan.cycleNext ? (
        <div className="type-meta mt-3 flex items-center justify-between gap-3 rounded-nested bg-surface-2 px-4 py-2.5">
          <span className="min-w-0 text-text-2">
            Next in your cycle:{' '}
            <span className="font-semibold text-text-1">{plan.cycleNext.name}</span>
          </span>
          <CycleButton dayId={plan.cycleNext.id} label={`Do ${plan.cycleNext.name}`} />
        </div>
      ) : null}
    </>
  );
}

function CycleButton({ dayId, label }: { dayId: string; label: string }) {
  const start = useStartWorkout();
  return (
    <TextLink small onClick={() => start(dayId)}>
      {label}
    </TextLink>
  );
}

function Done({ plan, unit }: { plan: Extract<TodayPlan, { kind: 'done' }>; unit: WeightUnit }) {
  const minutes = sessionDurationMinutes(plan.session);
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <div className="mt-1 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-lime text-on-lime">
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </span>
        <h2 id="today-title" className="type-title text-text-1">
          {plan.session.workout.name} done
        </h2>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        {minutes !== null ? (
          <GridStat label="Duration" value={formatDurationSummary(minutes)} />
        ) : null}
        <GridStat label="Working sets" value={String(plan.workingSets)} />
        {plan.volumeKg > 0 ? (
          <GridStat
            label="Volume load"
            value={`${formatNumber(toDisplayWeight(plan.volumeKg, unit), 0)} ${unit}`}
          />
        ) : null}
        <GridStat label="Exercises" value={String(plan.session.exercises.length)} />
      </dl>
      <div className="mt-4">
        <TextLink to={`/history/${plan.session.workout.id}`} chevron>
          View in history
        </TextLink>
      </div>
    </>
  );
}

function Rest({ plan }: { plan: Extract<TodayPlan, { kind: 'rest' }> }) {
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <div className="mt-1 flex items-center gap-3">
        <Moon className="size-6 text-text-2" aria-hidden />
        <h2 id="today-title" className="type-title text-text-1">
          Rest day
        </h2>
      </div>
      <p className="type-body mt-2 max-w-[40ch] text-text-2">
        {plan.next
          ? `Nothing planned in ${plan.routineName} today. Next up: ${plan.next.day.name} on ${formatWeekday(plan.next.date)}.`
          : `Nothing planned in ${plan.routineName} today.`}
      </p>
      {plan.cycleNext ? (
        <StartButton
          dayId={plan.cycleNext.id}
          label={`Do ${plan.cycleNext.name} today`}
          secondary
        />
      ) : (
        <StartButton dayId={null} label="Start an empty workout" secondary />
      )}
    </>
  );
}

function NoRoutine() {
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <h2 id="today-title" className="type-title mt-0.5 text-text-1">
        Train your way
      </h2>
      <p className="type-body mt-2 max-w-[42ch] text-text-2">
        Without a routine, start an empty workout and add exercises as you go. A routine lets this
        card show today’s plan.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <StartButton dayId={null} label="Start workout" className="sm:flex-1" />
        <ButtonLink to="/routines" variant="secondary" size="lg" className="sm:flex-1">
          Set up a routine
        </ButtonLink>
      </div>
    </>
  );
}

function StartButton({
  dayId,
  label,
  secondary,
  className,
}: {
  dayId: string | null;
  label: string;
  secondary?: boolean;
  className?: string;
}) {
  const start = useStartWorkout();
  return (
    <Button
      size="lg"
      block={!className}
      variant={secondary ? 'secondary' : 'primary'}
      className={className ?? 'mt-5'}
      icon={
        secondary ? (
          <Plus className="size-5" aria-hidden />
        ) : (
          <Play className="size-5 fill-current" aria-hidden />
        )
      }
      onClick={() => start(dayId)}
    >
      {label}
    </Button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-text-2">{label}</dt>
      <dd className="tabular font-semibold text-text-1">{value}</dd>
    </div>
  );
}

function GridStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="type-meta text-text-2">{label}</dt>
      <dd className="type-headline tabular mt-0.5 text-text-1">{value}</dd>
    </div>
  );
}
