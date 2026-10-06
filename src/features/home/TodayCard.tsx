import { Link } from 'react-router';
import { Check, Moon, Play, Plus } from 'lucide-react';
import type { TodayPlan } from '@/domain/analytics/dashboard';
import { sessionDurationMinutes } from '@/domain/analytics/sessions';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useStartWorkout } from '@/features/workout/StartWorkout';
import { cn } from '@/lib/cn';
import { formatRelativeDay, formatWeekday } from '@/lib/dates';
import { formatCompact, formatDurationMinutes, pluralize } from '@/lib/format';
import type { WeightUnit } from '@/lib/units';
import { toDisplayWeight } from '@/lib/units';

interface TodayCardProps {
  plan: TodayPlan;
  unit: WeightUnit;
  className?: string;
}

const MAX_LISTED = 4;

/** The one place on Home with a glow: the next thing to do. */
export function TodayCard({ plan, unit, className }: TodayCardProps) {
  return (
    <section
      aria-labelledby="today-title"
      className={cn(
        'relative overflow-hidden rounded-[1.6rem] bg-surface p-5 sm:p-6',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--glow), transparent)' }}
      />
      <div className="relative">
        {plan.kind === 'planned' ? <Planned plan={plan} /> : null}
        {plan.kind === 'done' ? <Done plan={plan} unit={unit} /> : null}
        {plan.kind === 'rest' ? <Rest plan={plan} /> : null}
        {plan.kind === 'no_routine' ? <NoRoutine /> : null}
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-muted">{children}</p>;
}

function Planned({ plan }: { plan: Extract<TodayPlan, { kind: 'planned' }> }) {
  const listed = plan.exercises.slice(0, MAX_LISTED);
  const more = plan.exercises.length - listed.length;
  const totalSets = plan.exercises.reduce((n, e) => n + e.sets, 0);
  return (
    <>
      <Eyebrow>Today in {plan.routineName}</Eyebrow>
      <h2
        id="today-title"
        className="mt-1 font-display text-[2.3rem] font-bold leading-[0.9] tracking-tight sm:text-[2.7rem]"
      >
        {plan.day.name}
      </h2>
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Meta label="Exercises" value={String(plan.exercises.length)} />
        <Meta label="Working sets" value={String(totalSets)} />
        {plan.estimatedMinutes ? (
          <Meta label="Last took" value={formatDurationMinutes(plan.estimatedMinutes)} />
        ) : null}
      </dl>
      <ol className="mt-5 divide-y divide-line border-y border-line">
        {listed.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="truncate font-medium">{e.name}</span>
            <span className="tabular shrink-0 text-sm text-muted">
              {e.sets} × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}
            </span>
          </li>
        ))}
      </ol>
      {more > 0 ? (
        <p className="mt-2.5 text-sm text-faint">and {pluralize(more, 'more exercise')}</p>
      ) : null}
      {plan.lastSession ? (
        <p className="mt-1 text-sm text-faint">Last done {lastDoneLabel(plan.lastSession.date)}</p>
      ) : null}
      <StartButton dayId={plan.day.id} label={`Start ${plan.day.name}`} />
    </>
  );
}

function lastDoneLabel(date: Date): string {
  const rel = formatRelativeDay(date);
  return rel === 'Today' || rel === 'Yesterday' ? rel.toLowerCase() : `on ${rel}`;
}

function Done({ plan, unit }: { plan: Extract<TodayPlan, { kind: 'done' }>; unit: WeightUnit }) {
  const minutes = sessionDurationMinutes(plan.session);
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <div className="mt-1 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </span>
        <h2 id="today-title" className="font-display text-[1.75rem] font-bold leading-none">
          {plan.session.workout.name} done
        </h2>
      </div>
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {minutes !== null ? <Meta label="Duration" value={formatDurationMinutes(minutes)} /> : null}
        <Meta label="Working sets" value={String(plan.workingSets)} />
        {plan.volumeKg > 0 ? (
          <Meta
            label="Volume"
            value={`${formatCompact(toDisplayWeight(plan.volumeKg, unit))} ${unit}`}
          />
        ) : null}
      </dl>
      <Link
        to="/history"
        className="mt-5 inline-block text-sm font-medium text-accent-text underline-offset-4 hover:underline"
      >
        View in history
      </Link>
    </>
  );
}

function Rest({ plan }: { plan: Extract<TodayPlan, { kind: 'rest' }> }) {
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <div className="mt-1 flex items-center gap-3">
        <Moon className="size-7 text-muted" aria-hidden />
        <h2 id="today-title" className="font-display text-[2rem] font-bold leading-none">
          Rest day
        </h2>
      </div>
      <p className="mt-3 max-w-[40ch] text-muted">
        {plan.next
          ? `Nothing planned in ${plan.routineName} today. Next up: ${plan.next.day.name} on ${formatWeekday(plan.next.date)}.`
          : `Nothing planned in ${plan.routineName} today.`}
      </p>
      <StartButton dayId={null} label="Start an empty workout" secondary />
    </>
  );
}

function NoRoutine() {
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <h2 id="today-title" className="mt-1 font-display text-[1.75rem] font-bold leading-none">
        Train your way
      </h2>
      <p className="mt-3 max-w-[42ch] text-muted">
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
      <dt className="text-faint">{label}</dt>
      <dd className="tabular font-semibold text-text">{value}</dd>
    </div>
  );
}
