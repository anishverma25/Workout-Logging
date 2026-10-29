import { useState } from 'react';
import { Check, ChevronDown, Moon, Play, Plus } from 'lucide-react';
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
import { Metric, StatGrid, TextButton } from '@/components/kit';
import type { WeightUnit } from '@/lib/units';
import { toDisplayWeight } from '@/lib/units';

interface TodayCardProps {
  plan: TodayPlan;
  unit: WeightUnit;
  className?: string;
}

/**
 * The next thing to do, and the first thing on Home (UI v3, S3.3): the session, one line about
 * it and its Start button, with the exercise list folded into one line that opens on a tap.
 */
export function TodayCard({ plan, unit, className }: TodayCardProps) {
  return (
    <section
      aria-labelledby="today-title"
      className={cn('rounded-card bg-surface p-4', className)}
      data-today-card
    >
      {plan.kind === 'planned' ? <Planned plan={plan} /> : null}
      {plan.kind === 'done' ? <Done plan={plan} unit={unit} /> : null}
      {plan.kind === 'rest' ? <Rest plan={plan} /> : null}
      {plan.kind === 'no_routine' ? <NoRoutine /> : null}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="type-meta font-semibold text-lime">{children}</p>;
}

function Planned({ plan }: { plan: Extract<TodayPlan, { kind: 'planned' }> }) {
  const [open, setOpen] = useState(false);
  const totalSets = plan.exercises.reduce((n, e) => n + e.sets, 0);
  const meta = [
    pluralize(plan.exercises.length, 'exercise'),
    pluralize(totalSets, 'set'),
    plan.estimatedMinutes ? `last took ${formatDurationSummary(plan.estimatedMinutes)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const names = plan.exercises.map((e) => e.name);
  const summary =
    names.length <= 2
      ? names.join(' and ')
      : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  return (
    <>
      <Eyebrow>Today · {plan.routineName}</Eyebrow>
      <h2 id="today-title" className="type-title-1 mt-0.5 text-text-1">
        {plan.day.name}
      </h2>
      <p className="type-subhead mt-0.5 text-text-2">{meta}</p>
      {plan.exercises.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="pressable chrome type-subhead mt-2.5 flex w-full items-start gap-1 text-left text-text-1/85"
          data-today-exercises
        >
          <span className="min-w-0 flex-1">{open ? 'Exercises' : summary}</span>
          <ChevronDown
            className={cn(
              'mt-0.5 size-4 shrink-0 text-text-3 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      ) : null}
      {open ? (
        <ol className="mt-1 divide-y-[0.5px] divide-divider">
          {plan.exercises.map((e) => (
            <li key={e.id} className="flex min-h-10 items-center justify-between gap-4 py-1.5">
              <span className="type-subhead truncate text-text-1">{e.name}</span>
              <span className="type-meta tabular shrink-0 text-text-2">
                {e.sets} × {formatRepRange(e.repMin, e.repMax)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {plan.lastSession ? (
        <p className="type-meta mt-2 text-text-2">
          Last done {formatDateInSentence(plan.lastSession.date)}
        </p>
      ) : null}
      <StartButton dayId={plan.day.id} label={`Start ${plan.day.name}`} />
      {plan.cycleNext ? (
        <div className="type-meta mt-3 flex items-center justify-between gap-3">
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
    <TextButton small onClick={() => start(dayId)}>
      {label}
    </TextButton>
  );
}

function Done({ plan, unit }: { plan: Extract<TodayPlan, { kind: 'done' }>; unit: WeightUnit }) {
  const minutes = sessionDurationMinutes(plan.session);
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <div className="mt-1 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-lime text-on-lime">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        <h2 id="today-title" className="type-title text-text-1">
          {plan.session.workout.name} done
        </h2>
      </div>
      <StatGrid className="mt-4">
        {minutes !== null && minutes >= 1 ? (
          <Metric label="Duration" value={formatDurationSummary(minutes)} tier="secondary" />
        ) : null}
        <Metric label="Working sets" value={String(plan.workingSets)} tier="secondary" />
        {plan.volumeKg > 0 ? (
          <Metric
            label="Volume load"
            value={formatNumber(toDisplayWeight(plan.volumeKg, unit), 0)}
            unit={unit}
            tier="secondary"
          />
        ) : null}
        <Metric label="Exercises" value={String(plan.session.exercises.length)} tier="secondary" />
      </StatGrid>
      <div className="mt-4">
        <TextButton to={`/history/${plan.session.workout.id}`}>View in history</TextButton>
      </div>
    </>
  );
}

function Rest({ plan }: { plan: Extract<TodayPlan, { kind: 'rest' }> }) {
  return (
    <>
      <Eyebrow>Today</Eyebrow>
      <div className="mt-1 flex items-center gap-2.5">
        <Moon className="size-6 text-text-2" aria-hidden />
        <h2 id="today-title" className="type-title-1 text-text-1">
          Rest day
        </h2>
      </div>
      <p className="type-subhead mt-1 text-text-2">
        {plan.next
          ? `Next: ${plan.next.day.name} on ${formatWeekday(plan.next.date)}`
          : `Nothing planned in ${plan.routineName} today`}
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
      <h2 id="today-title" className="type-title-1 mt-0.5 text-text-1">
        Train your way
      </h2>
      <p className="type-subhead mt-1 max-w-[42ch] text-text-2">
        Start an empty workout and add exercises as you go, or set up a routine and this card shows
        today’s plan.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
      className={className ?? 'mt-4'}
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
