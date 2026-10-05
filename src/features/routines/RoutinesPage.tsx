import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarRange, ChevronRight, Copy, Ellipsis, Plus, Star, Trash2 } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ActionList } from '@/components/ui/Fields';
import { IconButton } from '@/components/ui/Button';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences, useTrainingData } from '@/data/hooks';
import {
  createRoutineFromTemplate,
  deleteRoutine,
  duplicateRoutine,
  setActiveRoutine,
} from '@/data/repositories/routines';
import { ROUTINE_TEMPLATES } from '@/data/library/templates';
import { daysForRoutine } from '@/domain/analytics/schedule';
import type { Routine } from '@/domain/models/schemas';
import type { TrainingData } from '@/domain/analytics/sessions';
import { orderedWeekdays, weekdayShortName } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/cn';

export function RoutinesPage() {
  const training = useTrainingData();
  const [creating, setCreating] = useState(false);
  const data = training.data;
  const routines = [...(data?.routines ?? [])].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <>
      <PageHeader
        title="Routines"
        subtitle="Plans for future workouts. Editing one never changes past workouts."
        actions={
          routines.length > 0 ? (
            <Button
              size="sm"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setCreating(true)}
              className="max-sm:hidden"
            >
              New routine
            </Button>
          ) : undefined
        }
      />
      {training.status === 'loading' ? <Skeleton className="h-72" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {data && routines.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-5" aria-hidden />}
          title="No routines yet"
          body="A routine is your plan: training days, exercises and target sets and reps. It tells Home what to train today, starts workouts with everything filled in, and makes adherence measurable."
          actions={
            <Button
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setCreating(true)}
            >
              Create a routine
            </Button>
          }
        />
      ) : null}

      {data ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {routines.map((r) => (
            <li key={r.id}>
              <RoutineCard routine={r} data={data} />
            </li>
          ))}
        </ul>
      ) : null}

      {routines.length > 0 ? (
        <Button
          variant="secondary"
          block
          className="mt-5 sm:hidden"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => setCreating(true)}
        >
          New routine
        </Button>
      ) : null}

      <NewRoutineSheet open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function RoutineCard({ routine, data }: { routine: Routine; data: TrainingData }) {
  const prefs = usePreferences();
  const toast = useToast();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const days = daysForRoutine(routine, data.routineDays);
  const planned = new Map<number, string>();
  days.forEach((d) => d.weekdays.forEach((w) => planned.set(w, d.name)));
  const exerciseCount = data.routineExercises.filter((re) =>
    days.some((d) => d.id === re.routineDayId),
  ).length;

  return (
    <article
      className={cn(
        'relative rounded-[var(--radius-card)] border bg-surface p-5 shadow-[var(--shadow-card)] transition-colors',
        routine.isActive ? 'border-accent-text/40' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {routine.isActive ? <Badge tone="accent">Active</Badge> : null}
            {routine.origin === 'demo' ? <Badge tone="warn">Demo</Badge> : null}
          </div>
          <h2 className="mt-2 font-display text-[1.75rem] font-bold leading-none">
            <Link
              to={`/routines/${routine.id}`}
              className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none"
            >
              {routine.name}
            </Link>
          </h2>
          <p className="mt-2 text-sm text-muted">
            {pluralize(days.length, 'day')} · {pluralize(exerciseCount, 'exercise')}
            {planned.size > 0 ? ` · ${planned.size} per week` : ''}
          </p>
        </div>
        <IconButton
          label={`Options for ${routine.name}`}
          icon={<Ellipsis className="size-5" aria-hidden />}
          onClick={() => setMenu(true)}
          className="relative z-10 -mr-2 -mt-1"
        />
      </div>

      {/* Week strip: which day trains when. */}
      <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Weekly plan">
        {orderedWeekdays(prefs.weekStartsOn).map((w) => {
          const name = planned.get(w);
          return (
            <li
              key={w}
              className={cn(
                'flex h-12 flex-col items-center justify-center rounded-xl text-center',
                name ? 'bg-surface-2' : 'border border-dashed border-line',
              )}
            >
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-faint">
                {weekdayShortName(w)}
              </span>
              <span className="w-full truncate px-1 text-xs font-semibold">
                {name ?? <span className="sr-only">Rest</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex items-center justify-between text-sm font-medium text-accent-text">
        <span>Edit routine</span>
        <ChevronRight className="size-4" aria-hidden />
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={routine.name}>
        <ActionList
          items={[
            {
              label: routine.isActive ? 'This is your active routine' : 'Make active',
              hint: 'Home suggests its days, and adherence is measured against it.',
              icon: <Star className="size-5" aria-hidden />,
              disabled: routine.isActive,
              onSelect: async () => {
                await setActiveRoutine(db, routine.id);
                toast(`${routine.name} is now active`);
                setMenu(false);
              },
            },
            {
              label: 'Duplicate',
              icon: <Copy className="size-5" aria-hidden />,
              onSelect: async () => {
                const copy = await duplicateRoutine(db, routine.id);
                setMenu(false);
                navigate(`/routines/${copy.id}`);
              },
            },
            {
              label: 'Delete',
              icon: <Trash2 className="size-5" aria-hidden />,
              danger: true,
              onSelect: () => {
                setMenu(false);
                setConfirmDelete(true);
              },
            },
          ]}
        />
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        title={`Delete ${routine.name}?`}
        body="The plan is removed. Workouts you already logged from it stay in your history exactly as they are."
        confirmLabel="Delete routine"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteRoutine(db, routine.id);
          setConfirmDelete(false);
          toast('Routine deleted');
        }}
      />
    </article>
  );
}

export function NewRoutineSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="New routine"
      description="Templates are starting points, not prescriptions. Every day, exercise and target is yours to change."
    >
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {ROUTINE_TEMPLATES.map((t) => (
          <li key={t.key}>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await createRoutineFromTemplate(db, t.key);
                  onClose();
                  navigate(`/routines/${r.id}`);
                } finally {
                  setBusy(false);
                }
              }}
              className="flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-line bg-surface-2/50 p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className="font-display text-xl font-semibold">{t.name}</span>
                <span className="shrink-0 text-sm text-faint">
                  {t.daysPerWeek ? `${t.daysPerWeek} days a week` : 'Blank'}
                </span>
              </span>
              <span className="text-sm text-muted">{t.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
