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
import { usePreferences, useProfile, useTrainingData } from '@/data/hooks';
import { recommendProgram } from '@/data/library/programs';
import { Switch } from '@/components/ui/List';
import { EQUIPMENT_LABEL, EXPERIENCE_LABEL, GOAL_LABEL } from '@/domain/models/labels';
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
import { orderedWeekdays } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { FitText } from '@/features/shared/FitText';
import { pluralize, shortDayName } from '@/lib/format';
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
        actions={
          routines.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
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
          size="lg"
          block
          className="mt-4 sm:hidden"
          icon={<Plus className="size-5" aria-hidden />}
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
  const today = useNow().getDay();
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const days = daysForRoutine(routine, data.routineDays);
  const planned = new Map<number, string>();
  days.forEach((d) => d.weekdays.forEach((w) => planned.set(w, d.name)));
  const exerciseCount = data.routineExercises.filter((re) =>
    days.some((d) => d.id === re.routineDayId),
  ).length;

  return (
    <article className={cn('relative rounded-panel border border-border bg-surface p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {routine.isActive ? <Badge tone="accent">Active</Badge> : null}
            {routine.origin === 'demo' ? <Badge>Demo</Badge> : null}
          </div>
          <h2 className="type-title mt-2 text-text-1">
            <Link
              to={`/routines/${routine.id}`}
              className="after:absolute after:inset-0 after:rounded-panel focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
            >
              {routine.name}
            </Link>
          </h2>
          <p className="type-meta mt-1 text-text-2">
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
      <ol className="mt-4 flex gap-1.5" aria-label="Weekly plan">
        {orderedWeekdays(prefs.weekStartsOn).map((w) => {
          const name = planned.get(w);
          const isToday = w === today && routine.isActive;
          return (
            <li
              key={w}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex min-h-13 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-field px-0.5 py-1.5 text-center',
                isToday
                  ? 'bg-lime text-on-lime'
                  : name
                    ? 'bg-surface-2 text-text-1'
                    : 'border border-dashed border-border-strong',
              )}
            >
              <span className={cn('type-caption', isToday ? 'text-on-lime' : 'text-text-2')}>
                {shortDayName(w)}
              </span>
              <FitText
                className={cn(
                  'type-meta font-semibold',
                  !name && (isToday ? 'text-on-lime' : 'text-text-2'),
                )}
              >
                {name ?? 'Rest'}
              </FitText>
            </li>
          );
        })}
      </ol>

      <div className="type-body mt-4 flex items-center justify-between font-medium text-text-1">
        <span>Edit routine</span>
        <ChevronRight className="size-4 text-text-2" aria-hidden />
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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="New routine"
      description="Templates are starting points, not prescriptions. Every day, exercise and target is yours to change."
    >
      {open ? <TemplatePicker onClose={onClose} /> : null}
    </Sheet>
  );
}

function TemplatePicker({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const profile = useProfile().data;
  const own = profile?.origin === 'user' ? profile : null;
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState(!!own);
  const recommendation = own ? recommendProgram(own) : null;
  const ordered = recommendation
    ? [
        recommendation.template,
        ...ROUTINE_TEMPLATES.filter((t) => t.key !== recommendation.template.key),
      ]
    : ROUTINE_TEMPLATES;

  return (
    <>
      {own ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium">Fit to my profile</p>
            <p className="text-sm text-faint">
              Reps and rest for {GOAL_LABEL[own.goal].toLowerCase()}, sets for{' '}
              {EXPERIENCE_LABEL[own.experience].toLowerCase()}
              {own.equipment && own.equipment !== 'full_gym'
                ? `, exercises for ${EQUIPMENT_LABEL[own.equipment].toLowerCase()}`
                : ''}
              {own.sessionMinutes ? `, about ${own.sessionMinutes} minutes a session` : ''}.
            </p>
          </div>
          <Switch checked={fit} onChange={setFit} label="Fit to my profile" />
        </div>
      ) : null}
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {ordered.map((t) => {
          const recommended = recommendation?.template.key === t.key;
          return (
            <li key={t.key} className={cn(recommended && 'sm:col-span-2')}>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await createRoutineFromTemplate(
                      db,
                      t.key,
                      undefined,
                      fit && own
                        ? {
                            goal: own.goal,
                            experience: own.experience,
                            equipment: own.equipment ?? null,
                            sessionMinutes: own.sessionMinutes ?? null,
                          }
                        : undefined,
                    );
                    onClose();
                    navigate(`/routines/${r.id}`);
                  } finally {
                    setBusy(false);
                  }
                }}
                className={cn(
                  'pressable flex h-full w-full flex-col items-start gap-1 rounded-nested bg-surface-2 p-4 text-left ring-1',
                  recommended ? 'ring-border-strong' : 'ring-transparent',
                )}
              >
                {recommended ? (
                  <Badge tone="accent" className="mb-1">
                    Recommended for you
                  </Badge>
                ) : null}
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span className="type-headline text-text-1">{t.name}</span>
                  <span className="shrink-0 text-sm text-faint">
                    {t.daysPerWeek ? `${t.daysPerWeek} days a week` : 'Blank'}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {recommended ? recommendation!.reason : t.summary}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
