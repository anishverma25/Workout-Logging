import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  CalendarRange,
  Check,
  ChevronLeft,
  Copy,
  Ellipsis,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { useDragReorder } from '@/components/ui/useDragReorder';
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
  moveExerciseTo,
  removeExercise,
  renameDay,
  restoreExercise,
  setActiveRoutine,
  setDayWeekdays,
  updateRoutine,
} from '@/data/repositories/routines';
import { daysForRoutine } from '@/domain/analytics/schedule';
import type { Exercise, Routine, RoutineDay, RoutineExercise } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';
import { formatAngle } from '@/domain/workout/angle';
import { orderedWeekdays, weekdayLongName, type WeekStartsOn } from '@/lib/dates';
import { formatRepRange, formatSeconds, longDayName, pluralize, shortDayName } from '@/lib/format';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { readableError } from '@/lib/errors';
import { useStartWorkout } from '../workout/StartWorkout';
import { SlotSheet } from './SlotSheet';

/** Older personalised routines stored this line as their description; it is no longer shown. */
const LEGACY_PERSONALISED_NOTE = 'Fitted to your goal, experience and equipment.';

/** A target on an exercise row: surface-2, radius 8, Meta --text-2, tabular. */
function TargetChip({ children }: { children: ReactNode }) {
  return (
    <span className="type-meta tabular inline-flex h-6 items-center rounded-lg bg-surface-2 px-3 text-text-2">
      {children}
    </span>
  );
}

/** Day cards in weekday order from the week start; days with no weekday set go last. */
function byWeekday<T extends { weekdays: number[] }>(days: T[], weekStartsOn: WeekStartsOn): T[] {
  const rank = (w: number) => (w - weekStartsOn + 7) % 7;
  const first = (d: T) => (d.weekdays.length ? Math.min(...d.weekdays.map(rank)) : 7);
  return [...days].sort((a, b) => first(a) - first(b));
}

/** "Thursday", or "Monday, Thursday" for a day trained twice a week (D10). */
function dayLabel(weekdays: number[], weekStartsOn: WeekStartsOn): string {
  if (weekdays.length === 0) return 'No day set';
  const rank = (w: number) => (w - weekStartsOn + 7) % 7;
  return [...weekdays]
    .sort((a, b) => rank(a) - rank(b))
    .map(longDayName)
    .join(', ');
}

export function RoutineEditorPage() {
  const { routineId } = useParams();
  const training = useTrainingData();
  const navigate = useNavigate();
  const toast = useToast();
  const prefs = usePreferences();
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
      <div className="pt-1 lg:pt-6">
        <Link
          to="/routines"
          aria-label="Back to Routines"
          className="pressable tap-target type-body -ml-2 inline-flex h-11 items-center gap-0.5 rounded-field pr-2 font-medium text-text-1"
        >
          <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden /> Routines
        </Link>
      </div>
      <header className="flex items-start justify-between gap-3 pt-2 pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {routine.isActive ? <Badge tone="accent">Active</Badge> : null}
            {routine.origin === 'demo' ? <Badge>Demo</Badge> : null}
          </div>
          <h1 className="type-display mt-2 break-words text-text-1">
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="group inline-flex items-center gap-2 text-left"
            >
              {routine.name}
              <Pencil className="size-5 shrink-0 text-text-2" aria-label="Rename" />
            </button>
          </h1>
          {routine.description && routine.description !== LEGACY_PERSONALISED_NOTE ? (
            <p className="type-body mt-1 text-text-2">{routine.description}</p>
          ) : null}
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
        {byWeekday(days, prefs.weekStartsOn).map((day, index) => (
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
          className="mt-4"
          icon={<Plus className="size-5" aria-hidden />}
          onClick={async () => {
            await addDay(db, routine.id);
          }}
        >
          Add a training day
        </Button>
      ) : null}

      <p className="type-meta mt-6 text-text-2">Editing a routine never changes past workouts.</p>

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
  const [slotMenu, setSlotMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const owner = new Map<number, string>();
  allDays.forEach((d) => d.weekdays.forEach((w) => owner.set(w, d.name)));
  const totalSets = slots.reduce((n, s) => n + s.targetSets, 0);
  const slot = slots.find((s) => s.id === openSlot) ?? null;
  const menuIndex = slots.findIndex((s) => s.id === slotMenu);
  const menuSlot = slots[menuIndex] ?? null;
  const nameOf = (s: RoutineExercise) => exerciseById.get(s.exerciseId)?.name ?? 'Exercise';

  // Press, hold and drag a row to reorder; release without moving to open its menu.
  const reorder = useDragReorder({
    ids: slots.map((s) => s.id),
    onMove: (id, to) => void moveExerciseTo(db, id, to),
    onPress: (id) => setSlotMenu(id),
  });

  /** Removes an exercise from the day, with an undo in the toast. */
  const remove = async (s: RoutineExercise) => {
    await removeExercise(db, s.id);
    toast(`${nameOf(s)} removed`, {
      label: 'Undo',
      onSelect: () => void restoreExercise(db, s.id),
    });
  };

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
      className="flex flex-col rounded-panel border border-border bg-surface"
    >
      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div className="min-w-0">
          <p className="type-caption inline-flex h-6 items-center rounded-full bg-lime-dim px-2.5 font-semibold text-text-1">
            {dayLabel(day.weekdays, prefs.weekStartsOn)}
          </p>
          <h2 id={`day-${day.id}`} className="type-title mt-2 text-text-1">
            <button type="button" onClick={() => setRenaming(true)} className="text-left">
              {day.name}
            </button>
          </h2>
          <p className="type-meta mt-0.5 text-text-2">
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
              tone="default"
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
                  'pressable chrome type-meta h-9 rounded-field font-semibold',
                  on ? 'bg-text-1 text-bg' : 'bg-surface-2 text-text-1',
                  other && 'opacity-35',
                )}
              >
                {shortDayName(w)}
              </button>
            );
          })}
        </div>
        {day.weekdays.length === 0 ? (
          <p className="type-meta mt-1.5 text-text-2">
            Pick the weekdays you plan to train this day. It lets Home suggest it and makes
            adherence measurable.
          </p>
        ) : null}
      </div>

      <ol className="mt-3 flex-1 divide-y-[0.5px] divide-divider px-2">
        {slots.map((s, i) => {
          const exercise = exerciseById.get(s.exerciseId);
          return (
            <li
              key={s.id}
              className="flex items-center gap-1 bg-surface"
              {...reorder.itemProps(s.id)}
            >
              <div className="min-w-0 flex-1">
                <SwipeRow
                  disabled={reordering}
                  deleteLabel={`Delete ${nameOf(s)}`}
                  onDelete={() => void remove(s)}
                  onLongPress={(y, via) =>
                    via === 'menu' ? setSlotMenu(s.id) : reorder.start(s.id, y)
                  }
                >
                  <button
                    type="button"
                    disabled={reordering}
                    onClick={() => setOpenSlot(s.id)}
                    aria-haspopup="dialog"
                    className="flex min-h-15 w-full min-w-0 items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:hover:bg-transparent"
                  >
                    <span className="type-meta tabular w-5 shrink-0 font-semibold text-text-2">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="type-headline block truncate text-text-1">
                        {exercise?.name ?? 'Deleted exercise'}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <TargetChip>
                          {s.targetSets} × {formatRepRange(s.repMin, s.repMax)}
                        </TargetChip>
                        {s.targetRir !== null ? <TargetChip>RIR {s.targetRir}</TargetChip> : null}
                        <TargetChip>{formatSeconds(s.restSeconds)} rest</TargetChip>
                        {s.angleDeg != null ? (
                          <TargetChip>{formatAngle(s.angleDeg)}</TargetChip>
                        ) : null}
                      </span>
                      {s.notes ? (
                        <span className="type-meta mt-1 block truncate text-text-2">{s.notes}</span>
                      ) : null}
                      {s.supersetGroup != null &&
                      (slots[i + 1]?.supersetGroup === s.supersetGroup ||
                        slots[i - 1]?.supersetGroup === s.supersetGroup) ? (
                        <span className="type-meta mt-1 flex items-center gap-1.5 font-semibold text-text-2">
                          <span aria-hidden className="size-2 rounded-full bg-[var(--ring-2)]" />
                          {slots[i + 1]?.supersetGroup === s.supersetGroup
                            ? 'Superset with the next exercise'
                            : 'End of superset'}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </SwipeRow>
              </div>
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
          aria-label="Add exercises"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => setPicking(true)}
        >
          Add
        </Button>
        <Button
          variant="secondary"
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
      <Sheet
        open={menuSlot !== null}
        onClose={() => setSlotMenu(null)}
        title={menuSlot ? nameOf(menuSlot) : ''}
      >
        {menuSlot ? (
          <ActionList
            items={[
              {
                label: 'Edit sets, reps and rest',
                icon: <Pencil className="size-5" aria-hidden />,
                onSelect: () => {
                  setSlotMenu(null);
                  setOpenSlot(menuSlot.id);
                },
              },
              ...(menuIndex > 0
                ? [
                    {
                      label: 'Move up',
                      icon: <ArrowUp className="size-5" aria-hidden />,
                      onSelect: () => {
                        setSlotMenu(null);
                        void moveExercise(db, menuSlot.id, -1);
                      },
                    },
                  ]
                : []),
              ...(menuIndex < slots.length - 1
                ? [
                    {
                      label: 'Move down',
                      icon: <ArrowDown className="size-5" aria-hidden />,
                      onSelect: () => {
                        setSlotMenu(null);
                        void moveExercise(db, menuSlot.id, 1);
                      },
                    },
                  ]
                : []),
              {
                label: 'Delete from this day',
                icon: <Trash2 className="size-5" aria-hidden />,
                danger: true,
                onSelect: () => {
                  setSlotMenu(null);
                  void remove(menuSlot);
                },
              },
            ]}
          />
        ) : null}
      </Sheet>
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
