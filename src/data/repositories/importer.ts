import {
  BodyMeasurement,
  BodyWeightEntry,
  Exercise,
  Routine,
  RoutineDay,
  RoutineExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/models/schemas';
import { normalize } from '@/domain/exercises/search';
import type { ImportedLog } from '@/domain/import/formats';
import type { InferredRoutine } from '@/domain/import/routine';
import type { ExerciseChoice } from '@/domain/import/plan';
import { stableId } from '@/lib/ids';
import type { WorkoutDatabase } from '../db';
import { nowIso, putRecords } from './write';

/**
 * Saves an import from Hevy or Strong as ordinary Overload records, so every screen, record,
 * chart and insight treats it exactly like training logged here, and it syncs like it too.
 *
 * Importing the same export again adds nothing: every record's id is derived from the
 * account, the source and the workout, and anything already there (even if the person later
 * deleted it here) is left alone. Records that would break a rule (a 2,000 kg set, say) are
 * left out and counted, never stretched to fit.
 */

export interface ImportResult {
  workoutsAdded: number;
  /** Already imported before, so left as they are. */
  workoutsSkipped: number;
  setsAdded: number;
  exercisesCreated: number;
  bodyWeightsAdded: number;
  measurementsAdded: number;
  /** Sets and entries left out because a value was impossible. */
  dropped: number;
  /** The routine created from recent workouts, if one was asked for and is new. */
  routine: { id: string; name: string; days: number; active: boolean } | null;
}

/** How an imported routine says where it came from, in its description. */
export const IMPORTED_ROUTINE_NOTE = {
  hevy: 'Imported from Hevy',
  strong: 'Imported from Strong',
} as const;

const ms = (d: Date) => d.toISOString();
const clampRir = (rpe: number) => Math.max(0, Math.min(10, Math.round((10 - rpe) * 2) / 2));

function within(value: number | null, min: number, max: number): number | null {
  return value !== null && value >= min && value <= max ? value : null;
}

/**
 * @param namespace Keeps ids unique per account (the user id), so two people importing the
 * same file never collide on the server.
 * @param choices What each imported exercise name becomes, by name.
 */
export async function applyImport(
  db: WorkoutDatabase,
  log: ImportedLog,
  choices: Record<string, ExerciseChoice>,
  namespace: string,
  options: { routine?: InferredRoutine | null } = {},
): Promise<ImportResult> {
  const result: ImportResult = {
    workoutsAdded: 0,
    workoutsSkipped: 0,
    setsAdded: 0,
    exercisesCreated: 0,
    bodyWeightsAdded: 0,
    measurementsAdded: 0,
    dropped: 0,
    routine: null,
  };
  const at = nowIso();
  const meta = (id: string) => ({
    id,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    origin: 'user' as const,
  });
  const key = (...parts: string[]) =>
    stableId(['import', namespace, log.source, ...parts].join('|'));
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  await db.transaction(
    'rw',
    [
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.sets,
      db.bodyWeights,
      db.bodyMeasurements,
      db.routines,
      db.routineDays,
      db.routineExercises,
      db.outbox,
    ],
    async () => {
      // --- Exercises: the person's choices, creating their own ones where asked.
      const existing = (await db.exercises.toArray()).filter((e) => e.deletedAt === null);
      const byName = new Map(existing.map((e) => [normalize(e.name), e]));
      const exerciseFor = new Map<string, Exercise>();
      const newExercises: Exercise[] = [];
      for (const [name, choice] of Object.entries(choices)) {
        if (choice.kind === 'existing') {
          const ex = existing.find((e) => e.id === choice.exerciseId);
          if (ex) exerciseFor.set(name, ex);
          continue;
        }
        const wanted = normalize(choice.exercise.name);
        const same = byName.get(wanted);
        if (same) {
          exerciseFor.set(name, same);
          continue;
        }
        const parsed = Exercise.safeParse({
          ...meta(stableId(['import', namespace, 'exercise', wanted].join('|'))),
          ...choice.exercise,
          secondaryMuscles: [],
          instructions: null,
          isCustom: true,
        });
        if (!parsed.success) continue;
        newExercises.push(parsed.data);
        byName.set(wanted, parsed.data);
        exerciseFor.set(name, parsed.data);
      }
      await putRecords(db, 'exercises', newExercises);
      result.exercisesCreated = newExercises.length;

      // Workouts done from a routine day are linked to it, as if they had been logged here.
      const dayFor = new Map<string, { routineId: string; dayId: string }>();
      // --- The routine they were following, so the next workout starts from it.
      if (options.routine && options.routine.days.length > 0) {
        const plan = options.routine;
        const routineId = key('routine', normalize(plan.name));
        if (!(await db.routines.get(routineId))) {
          const hasActive =
            (await db.routines.filter((r) => r.deletedAt === null && r.isActive).count()) > 0;
          const days: RoutineDay[] = [];
          const slots: RoutineExercise[] = [];
          for (const d of plan.days) {
            const dayId = stableId(`${routineId}|day|${days.length}`);
            const supersets = new Map<string, number>();
            const daySlots: RoutineExercise[] = [];
            for (const slot of d.slots) {
              const exercise = exerciseFor.get(slot.name);
              if (!exercise) continue;
              let group: number | null = null;
              if (slot.supersetKey) {
                if (!supersets.has(slot.supersetKey) && supersets.size < 50)
                  supersets.set(slot.supersetKey, supersets.size + 1);
                group = supersets.get(slot.supersetKey) ?? null;
              }
              const parsed = RoutineExercise.safeParse({
                ...meta(stableId(`${dayId}|slot|${daySlots.length}`)),
                routineDayId: dayId,
                exerciseId: exercise.id,
                order: daySlots.length,
                targetSets: slot.sets,
                repMin: Math.min(slot.repMin, slot.repMax),
                repMax: Math.max(slot.repMin, slot.repMax),
                targetRir: slot.targetRir,
                restSeconds: exercise.category === 'compound' ? 150 : 90,
                notes: null,
                supersetGroup: group,
              });
              if (parsed.success) daySlots.push(parsed.data);
            }
            if (daySlots.length === 0) continue;
            const day = RoutineDay.safeParse({
              ...meta(dayId),
              routineId,
              name: d.name,
              order: days.length,
              weekdays: d.weekdays,
            });
            if (!day.success) continue;
            days.push(day.data);
            slots.push(...daySlots);
            dayFor.set(d.title, { routineId, dayId });
          }
          const routine = Routine.safeParse({
            ...meta(routineId),
            name: plan.name,
            description: IMPORTED_ROUTINE_NOTE[log.source],
            isActive: !hasActive,
          });
          if (!routine.success || days.length === 0) dayFor.clear();
          if (routine.success && days.length > 0) {
            await putRecords(db, 'routines', [routine.data]);
            await putRecords(db, 'routineDays', days);
            await putRecords(db, 'routineExercises', slots);
            result.routine = {
              id: routine.data.id,
              name: routine.data.name,
              days: days.length,
              active: routine.data.isActive,
            };
          }
        }
      }

      // --- Workouts, their exercises and sets.
      const workouts: Workout[] = [];
      const workoutExercises: WorkoutExercise[] = [];
      const sets: WorkoutSet[] = [];
      for (const w of log.workouts) {
        const workoutId = key('workout', w.key);
        if (await db.workouts.get(workoutId)) {
          result.workoutsSkipped++;
          continue;
        }
        const done = ms(w.endedAt ?? w.startedAt);
        const supersets = new Map<string, number>();
        const exRows: WorkoutExercise[] = [];
        const setRows: WorkoutSet[] = [];
        w.exercises.forEach((ex, exIndex) => {
          const exercise = exerciseFor.get(ex.name);
          if (!exercise) {
            result.dropped += ex.sets.length;
            return;
          }
          const weId = stableId(`${workoutId}|ex|${exIndex}`);
          let group: number | null = null;
          if (ex.supersetKey) {
            if (!supersets.has(ex.supersetKey) && supersets.size < 50)
              supersets.set(ex.supersetKey, supersets.size + 1);
            group = supersets.get(ex.supersetKey) ?? null;
          }
          const we = WorkoutExercise.safeParse({
            ...meta(weId),
            workoutId,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            order: exRows.length,
            notes: ex.notes?.slice(0, 500) ?? null,
            target: null,
            supersetGroup: group,
          });
          if (!we.success) {
            result.dropped += ex.sets.length;
            return;
          }
          let order = 0;
          ex.sets.forEach((s, i) => {
            const set = WorkoutSet.safeParse({
              ...meta(stableId(`${weId}|set|${i}`)),
              workoutId,
              workoutExerciseId: weId,
              exerciseId: exercise.id,
              order,
              setType: s.setType,
              weightKg: s.weightKg,
              reps: s.reps,
              rir: s.rpe === null ? null : clampRir(s.rpe),
              rpe: s.rpe,
              durationSec: s.durationSec,
              distanceM: s.distanceM,
              completedAt: done,
              notes: s.notes?.slice(0, 500) ?? null,
            });
            if (!set.success) {
              result.dropped++;
              return;
            }
            setRows.push(set.data);
            order++;
          });
          if (order > 0) exRows.push(we.data);
        });
        if (setRows.length === 0) continue;
        const workout = Workout.safeParse({
          ...meta(workoutId),
          name: w.title.slice(0, 60),
          routineId: dayFor.get(w.title)?.routineId ?? null,
          routineDayId: dayFor.get(w.title)?.dayId ?? null,
          status: 'completed',
          startedAt: ms(w.startedAt),
          endedAt: w.endedAt ? ms(w.endedAt) : null,
          pausedAt: null,
          pausedMs: 0,
          notes: w.notes?.slice(0, 2000) ?? null,
          timeZone,
        });
        if (!workout.success) {
          result.dropped += setRows.length;
          continue;
        }
        workouts.push(workout.data);
        workoutExercises.push(...exRows);
        sets.push(...setRows);
      }
      // Parents first, so a sync that starts part-way never sends a set before its workout.
      await putRecords(db, 'workouts', workouts);
      await putRecords(db, 'workoutExercises', workoutExercises);
      await putRecords(db, 'sets', sets);
      result.workoutsAdded = workouts.length;
      result.setsAdded = sets.length;

      // --- Body weight and measurements.
      const weights: BodyWeightEntry[] = [];
      const measurements: BodyMeasurement[] = [];
      for (const b of log.body) {
        const when = ms(b.measuredAt);
        if (b.weightKg !== null) {
          const id = key('weight', when);
          const entry = BodyWeightEntry.safeParse({
            ...meta(id),
            measuredAt: when,
            weightKg: b.weightKg,
            enteredUnit: b.enteredUnit,
            note: null,
          });
          if (!entry.success) result.dropped++;
          else if (!(await db.bodyWeights.get(id))) weights.push(entry.data);
        }
        const fields = {
          waistCm: within(b.waistCm, 30, 250),
          neckCm: within(b.neckCm, 15, 80),
          hipCm: within(b.hipCm, 40, 250),
          chestCm: within(b.chestCm, 40, 250),
          armCm: within(b.armCm, 10, 80),
          thighCm: within(b.thighCm, 20, 120),
          calfCm: within(b.calfCm, 15, 80),
          bodyFatPct: within(b.bodyFatPct, 2, 70),
        };
        if (Object.values(fields).some((v) => v !== null)) {
          const id = key('measure', when);
          const entry = BodyMeasurement.safeParse({
            ...meta(id),
            measuredAt: when,
            ...fields,
            note: null,
          });
          if (!entry.success) result.dropped++;
          else if (!(await db.bodyMeasurements.get(id))) measurements.push(entry.data);
        }
      }
      await putRecords(db, 'bodyWeights', weights);
      await putRecords(db, 'bodyMeasurements', measurements);
      result.bodyWeightsAdded = weights.length;
      result.measurementsAdded = measurements.length;
    },
  );
  return result;
}
