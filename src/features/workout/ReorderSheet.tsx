import { GripVertical } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { useDragReorder } from '@/components/ui/useDragReorder';
import { useLongPress } from '@/components/ui/useLongPress';
import { db } from '@/data/db';
import { moveWorkoutExerciseTo } from '@/data/repositories/workouts';
import type { WorkoutExerciseView } from '@/data/repositories/workoutView';

/**
 * The workout's exercises as a compact list to reorder: drag a row by its handle, or press and
 * hold anywhere on it. Exercise cards are too tall to drag comfortably, so this is where it
 * happens. Opened by holding an exercise's name.
 */
export function ReorderSheet({
  open,
  exercises,
  onClose,
}: {
  open: boolean;
  exercises: WorkoutExerciseView[];
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Reorder exercises"
      description="Drag an exercise by its handle, or press and hold it, then move it up or down."
    >
      {open ? <ReorderList exercises={exercises} /> : null}
    </Sheet>
  );
}

function ReorderList({ exercises }: { exercises: WorkoutExerciseView[] }) {
  const ids = exercises.map((e) => e.workoutExercise.id);
  const reorder = useDragReorder({
    ids,
    onMove: (id, to) => void moveWorkoutExerciseTo(db, id, to),
  });
  return (
    <ol className="flex flex-col gap-1.5" aria-label="Exercises in this workout">
      {exercises.map((ex, i) => (
        <Row
          key={ex.workoutExercise.id}
          ex={ex}
          index={i}
          count={exercises.length}
          reorder={reorder}
        />
      ))}
    </ol>
  );
}

function Row({
  ex,
  index,
  count,
  reorder,
}: {
  ex: WorkoutExerciseView;
  index: number;
  count: number;
  reorder: ReturnType<typeof useDragReorder>;
}) {
  const id = ex.workoutExercise.id;
  const hold = useLongPress((y) => reorder.start(id, y));
  const done = ex.sets.filter((s) => s.completedAt !== null).length;
  return (
    <li
      {...reorder.itemProps(id)}
      {...hold}
      className="flex touch-pan-y select-none items-center gap-3 rounded-[0.9rem] bg-surface-2 py-1 pl-4 pr-1 [-webkit-touch-callout:none]"
    >
      <span className="tabular w-5 shrink-0 text-sm font-semibold text-faint">{index + 1}</span>
      <span className="min-w-0 flex-1 py-2">
        <span className="block truncate font-semibold">{ex.workoutExercise.exerciseName}</span>
        <span className="tabular block text-sm text-faint">
          {done} of {ex.sets.length} sets done
        </span>
      </span>
      <button
        type="button"
        aria-label={`Move ${ex.workoutExercise.exerciseName}. Use the arrow keys to move it.`}
        onPointerDown={(e) => {
          e.preventDefault();
          reorder.start(id, e.clientY);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault();
            void moveWorkoutExerciseTo(db, id, index - 1);
          }
          if (e.key === 'ArrowDown' && index < count - 1) {
            e.preventDefault();
            void moveWorkoutExerciseTo(db, id, index + 1);
          }
        }}
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-faint active:cursor-grabbing"
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
    </li>
  );
}
