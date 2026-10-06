import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowUp,
  CalendarRange,
  Check,
  Copy,
  Ellipsis,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ActionList, TextArea, TextField } from '@/components/ui/Fields';
import { IconButton } from '@/components/ui/Button';
import { ConfirmSheet, Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences, useTrainingData } from '@/data/hooks';
import {
  addDay,
  addExercisesToDay,
  deleteDay,
  deleteRoutine,
  duplicateDay,
  duplicateRoutine,
  moveDay,
  moveExercise,
  renameDay,
  setActiveRoutine,
  setDayWeekdays,
  updateRoutine,
} from '@/data/repositories/routines';
import { daysForRoutine } from '@/domain/analytics/schedule';
import type { Exercise, Routine, RoutineDay, RoutineExercise } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { orderedWeekdays, weekdayLongName, weekdayShortName } from '@/lib/dates';
import { formatRepRange, formatSeconds, pluralize } from '@/lib/format';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { readableError } from '@/lib/errors';
import { useStartWorkout } from '../workout/StartWorkout';
import { SlotSheet } from './SlotSheet';

export function RoutineEditorPage() {
  const { routineId } = useParams();
  const training = useTrainingData();
  const navigate = useNavigate();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (training.status === 'loading') return <Skeleton className="mt-10 h-96" />;
  if (training.status === 'error') return <ErrorState error={training.error} />;
  const data = training.data;
  const routine = data.routines.find((r) => r.id === routineId);
  if (!routine) {
    return (
      <div className="pt-10">
        <EmptyState
          icon={<CalendarRange className="size-5" aria-hidden />}
          title="Routine not found"
          body="It may have been deleted. Your logged workouts are not affected."
          actions={
            <Button variant="secondary" onClick={() => navigate('/routines')}>
              Back to routines
            </Button>
          }
        />
      </div>
    );
  }
  const days = daysForRoutine(routine, data.routineDays);
  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]));

  return (
    <>
      <div className="pt-4 lg:pt-8">
        <Link
          to="/routines"
          className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden /> Routines
        </Link>
      </div>
      <header className="flex items-start justify-between gap-3 pb-6 pt-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {routine.isActive ? <Badge tone="accent">Active</Badge> : null}
            {routine.origin === 'demo' ? <Badge tone="warn">Demo</Badge> : null}
          </div>
          <h1 className="mt-2 font-display text-[1.4rem] font-bold leading-none sm:text-[1.75rem]">
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="group inline-flex items-center gap-2 text-left"
            >
              {routine.name}
              <Pencil
                className="size-4 text-faint opacity-60 transition-opacity group-hover:opacity-100"
                aria-label="Rename"
              />
            </button>
          </h1>
          {routine.description ? <p className="mt-2 text-muted">{routine.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!routine.isActive ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Star className="size-4" aria-hidden />}
              onClick={async () => {
                await setActiveRoutine(db, routine.id);
                toast(`${routine.name} is now active`);
              }}
              className="max-sm:hidden"
            >
              Make active
            </Button>
          ) : null}
          <IconButton
            label="Routine options"
            icon={<Ellipsis className="size-5" aria-hidden />}
            onClick={() => setMenu(true)}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {days.map((day, index) => (
          <DayCard
            key={day.id}
            day={day}
            index={index}
            dayCount={days.length}
            allDays={days}
            slots={data.routineExercises
              .filter((re) => re.routineDayId === day.id)
              .sort((a, b) => a.order - b.order)}
            exerciseById={exerciseById}
          />
        ))}
      </div>

      {days.length < 7 ? (
        <Button
          variant="secondary"
          block
          size="lg"
          className="mt-4 border-dashed"
          icon={<Plus className="size-5" aria-hidden />}
          onClick={async () => {
            await addDay(db, routine.id);
          }}
        >
          Add a training day
        </Button>
      ) : null}

      {renaming ? (
        <RenameRoutineSheet routine={routine} onClose={() => setRenaming(false)} />
      ) : null}
      <Sheet open={menu} onClose={() => setMenu(false)} title={routine.name}>
        <ActionList
          items={[
            {
              label: 'Rename or describe',
              icon: <Pencil className="size-5" aria-hidden />,
              onSelect: () => {
                setMenu(false);
                setRenaming(true);
              },
            },
            {
              label: routine.isActive ? 'This is your active routine' : 'Make active',
              hint: 'Home suggests its days, and adherence is measured against it.',
              icon: <Star className="size-5" aria-hidden />,
              disabled: routine.isActive,
              onSelect: async () => {
                await setActiveRoutine(db, routine.id);
                setMenu(false);
                toast(`${routine.name} is now active`);
              },
            },
            {
              label: 'Duplicate routine',
              icon: <Copy className="size-5" aria-hidden />,
              onSelect: async () => {
                const copy = await duplicateRoutine(db, routine.id);
                setMenu(false);
                toast('Copy created');
                navigate(`/routines/${copy.id}`);
              },
            },
            {
              label: 'Delete routine',
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
          toast('Routine deleted');
          navigate('/routines');
        }}
      />
    </>
  );
}

function RenameRoutineSheet({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const [name, setName] = useState(routine.name);
  const [description, setDescription] = useState(routine.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await updateRoutine(db, routine.id, { name, description });
      onClose();
    } catch (err) {
      setError(readableError(err));
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Routine details"
      footer={
        <Button block onClick={save}>
          Save
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoComplete="off"
        />
        <TextArea
          label="Description (optional)"
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this block is for"
        />
      </form>
    </Sheet>
  );
}

interface DayCardProps {
  day: RoutineDay;
  index: number;
  dayCount: number;
  allDays: RoutineDay[];
  slots: RoutineExercise[];
  exerciseById: Map<string, Exercise>;
}

function DayCard({ day, index, dayCount, allDays, slots, exerciseById }: DayCardProps) {
  const toast = useToast();
  const prefs = usePreferences();
  const start = useStartWorkout();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const owner = new Map<number, string>();
  allDays.forEach((d) => d.weekdays.forEach((w) => owner.set(w, d.name)));
  const totalSets = slots.reduce((n, s) => n + s.targetSets, 0);
  const slot = slots.find((s) => s.id === openSlot) ?? null;

  const toggleWeekday = async (w: number) => {
    const next = day.weekdays.includes(w)
      ? day.weekdays.filter((x) => x !== w)
      : [...day.weekdays, w];
    const takenFrom = !day.weekdays.includes(w) ? owner.get(w) : undefined;
    await setDayWeekdays(db, day.id, next);
    if (takenFrom) toast(`${weekdayLongName(w)} moved from ${takenFrom} to ${day.name}`);
  };

  return (
    <section
      aria-labelledby={`day-${day.id}`}
      className="flex flex-col rounded-[var(--radius-card)] bg-surface"
    >
      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div className="min-w-0">
          <p className="text-sm text-faint">Day {index + 1}</p>
          <h2 id={`day-${day.id}`} className="font-display text-[1.4rem] font-bold leading-tight">
            <button type="button" onClick={() => setRenaming(true)} className="text-left">
              {day.name}
            </button>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {slots.length === 0
              ? 'No exercises yet'
              : `${pluralize(slots.length, 'exercise')} · ${pluralize(totalSets, 'set')}`}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {slots.length > 1 ? (
            <IconButton
              label={reordering ? 'Done reordering' : 'Reorder exercises'}
              icon={
                reordering ? (
                  <Check className="size-5" aria-hidden />
                ) : (
                  <ArrowDownUp className="size-5" aria-hidden />
                )
              }
              tone={reordering ? 'accent' : 'default'}
              onClick={() => setReordering((r) => !r)}
            />
          ) : null}
          <IconButton
            label={`Options for ${day.name}`}
            icon={<Ellipsis className="size-5" aria-hidden />}
            onClick={() => setMenu(true)}
          />
        </div>
      </div>

      <div className="px-5">
        <div
          role="group"
          aria-label={`Weekdays for ${day.name}`}
          className="grid grid-cols-7 gap-1"
        >
          {orderedWeekdays(prefs.weekStartsOn).map((w) => {
            const on = day.weekdays.includes(w);
            const other = !on ? owner.get(w) : undefined;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                aria-label={`${weekdayLongName(w)}${other ? `, currently ${other}` : ''}`}
                onClick={() => toggleWeekday(w)}
                className={cn(
                  'h-9 rounded-lg text-xs font-semibold transition-colors',
                  on
                    ? 'bg-accent text-accent-ink'
                    : other
                      ? 'bg-surface-2 text-faint line-through decoration-faint/60'
                      : 'bg-surface-2 text-muted hover:text-text',
                )}
              >
                {weekdayShortName(w)}
              </button>
            );
          })}
        </div>
        {day.weekdays.length === 0 ? (
          <p className="mt-1.5 text-xs text-faint">
            Pick the weekdays you plan to train this day. It lets Home suggest it and makes
            adherence measurable.
          </p>
        ) : null}
      </div>

      <ol className="mt-3 flex-1 divide-y divide-line px-2">
        {slots.map((s, i) => {
          const exercise = exerciseById.get(s.exerciseId);
          return (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                disabled={reordering}
                onClick={() => setOpenSlot(s.id)}
                className="flex min-h-15 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-2 disabled:hover:bg-transparent"
              >
                <span className="tabular w-5 shrink-0 text-sm font-semibold text-faint">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {exercise?.name ?? 'Deleted exercise'}
                  </span>
                  <span className="tabular block truncate text-sm text-muted">
                    {s.targetSets} × {formatRepRange(s.repMin, s.repMax)}
                    {s.targetRir !== null ? ` · RIR ${s.targetRir}` : ''}
                    {` · ${formatSeconds(s.restSeconds)} rest`}
                  </span>
                  {s.notes ? (
                    <span className="block truncate text-sm text-faint">{s.notes}</span>
                  ) : null}
                  {s.supersetGroup != null &&
                  (slots[i + 1]?.supersetGroup === s.supersetGroup ||
                    slots[i - 1]?.supersetGroup === s.supersetGroup) ? (
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <span aria-hidden className="size-2 rounded-full bg-[var(--ring-2)]" />
                      {slots[i + 1]?.supersetGroup === s.supersetGroup
                        ? 'Superset with the next exercise'
                        : 'End of superset'}
                    </span>
                  ) : null}
                </span>
              </button>
              {reordering ? (
                <span className="flex shrink-0">
                  <IconButton
                    label={`Move ${exercise?.name ?? 'exercise'} up`}
                    icon={<ArrowUp className="size-5" aria-hidden />}
                    disabled={i === 0}
                    onClick={() => moveExercise(db, s.id, -1)}
                  />
                  <IconButton
                    label={`Move ${exercise?.name ?? 'exercise'} down`}
                    icon={<ArrowDown className="size-5" aria-hidden />}
                    disabled={i === slots.length - 1}
                    onClick={() => moveExercise(db, s.id, 1)}
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex gap-2 p-4 pt-3">
        <Button
          variant="secondary"
          className="flex-1"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => setPicking(true)}
        >
          Add exercises
        </Button>
        <Button
          className="flex-1"
          disabled={slots.length === 0}
          icon={<Play className="size-4 fill-current" aria-hidden />}
          onClick={() => start(day.id)}
        >
          Start
        </Button>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        title={`Add to ${day.name}`}
        mode="multi"
        presentIds={slots.map((s) => s.exerciseId)}
        onPick={async (ids) => {
          await addExercisesToDay(db, day.id, ids);
          toast(`${pluralize(ids.length, 'exercise')} added to ${day.name}`);
        }}
      />
      <SlotSheet
        slot={slot}
        exercise={slot ? exerciseById.get(slot.exerciseId) : undefined}
        isFirst={slot ? slots[0]?.id === slot.id : false}
        isLast={slot ? slots[slots.length - 1]?.id === slot.id : false}
        onClose={() => setOpenSlot(null)}
      />
      {renaming ? <RenameDaySheet day={day} onClose={() => setRenaming(false)} /> : null}
      <Sheet open={menu} onClose={() => setMenu(false)} title={day.name}>
        <ActionList
          items={[
            {
              label: 'Rename day',
              icon: <Pencil className="size-5" aria-hidden />,
              onSelect: () => {
                setMenu(false);
                setRenaming(true);
              },
            },
            {
              label: 'Move earlier',
              icon: <ArrowUp className="size-5" aria-hidden />,
              disabled: index === 0,
              onSelect: async () => {
                await moveDay(db, day.id, -1);
                setMenu(false);
              },
            },
            {
              label: 'Move later',
              icon: <ArrowDown className="size-5" aria-hidden />,
              disabled: index === dayCount - 1,
              onSelect: async () => {
                await moveDay(db, day.id, 1);
                setMenu(false);
              },
            },
            {
              label: 'Duplicate day',
              hint: 'Copies the exercises and targets. Weekdays are left for you to pick.',
              icon: <Copy className="size-5" aria-hidden />,
              disabled: dayCount >= 7,
              onSelect: async () => {
                await duplicateDay(db, day.id);
                setMenu(false);
              },
            },
            {
              label: 'Delete day',
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
        title={`Delete ${day.name}?`}
        body="Its exercises and targets are removed from this routine. Past workouts are not affected."
        confirmLabel="Delete day"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteDay(db, day.id);
          setConfirmDelete(false);
        }}
      />
    </section>
  );
}

function RenameDaySheet({ day, onClose }: { day: RoutineDay; onClose: () => void }) {
  const [name, setName] = useState(day.name);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await renameDay(db, day.id, name);
      onClose();
    } catch (err) {
      setError(readableError(err));
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Rename day"
      footer={
        <Button block onClick={save}>
          Save
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Day name"
          value={name}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
      </form>
    </Sheet>
  );
}
