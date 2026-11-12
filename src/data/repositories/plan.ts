import type { Change, Decision, Temporary, Text } from '@/domain/brain/engine';
import {
  EVENT_KINDS,
  PAIN_AREAS,
  RED_FLAGS,
  type EventKind,
  type LifeEvent,
  type PainArea,
  type PainReport,
  type PainSeverity,
  type RedFlag,
} from '@/domain/brain/life';
import { rewriteRoutine, type DayPlan, type Patch, type Slot } from '@/domain/brain/rewrite';
import {
  PlanItem,
  type Exercise,
  type Profile,
  type RoutineDay,
  type RoutineExercise,
} from '@/domain/models/schemas';
import type { WorkoutDatabase } from '../db';
import { pickProfile } from './training';
import { newRecordMeta, patchRecord, putRecords, softDelete } from './write';

/**
 * What the adaptive plan remembers, kept in one table (`planItems`): things coming up, pain
 * reports, each week's decision with its answer, temporary changes with how to put them back,
 * what Macrotrophy AI may know, and planned meals. Everything is written through `write.ts`,
 * so it syncs like every other log.
 */

export class PlanError extends Error {}

const alive = (i: PlanItem) => i.deletedAt === null;
const tables = (db: WorkoutDatabase) => [db.planItems, db.outbox];

function make(
  kind: PlanItem['kind'],
  fields: Pick<PlanItem, 'startDate' | 'endDate' | 'data'> & { status?: PlanItem['status'] },
  at?: string,
): PlanItem {
  return PlanItem.parse({
    ...newRecordMeta('user', at),
    kind,
    status: fields.status ?? 'active',
    startDate: fields.startDate,
    endDate: fields.endDate,
    data: fields.data,
  });
}

export async function planItems(db: WorkoutDatabase): Promise<PlanItem[]> {
  return (await db.planItems.toArray()).filter(alive);
}

// ---------------------------------------------------------------------------------------------
// Coming up
// ---------------------------------------------------------------------------------------------

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
/** An event can run for at most this many days (Ramadan is 30). */
export const EVENT_MAX_DAYS = 45;

export async function addEvent(
  db: WorkoutDatabase,
  input: { kind: EventKind; start: string; end: string },
): Promise<PlanItem> {
  if (!EVENT_KINDS.includes(input.kind)) throw new PlanError('Choose what is coming up.');
  if (!isDate(input.start) || !isDate(input.end)) throw new PlanError('Choose both dates.');
  if (input.end < input.start) throw new PlanError('The last day is before the first day.');
  const days = (Date.parse(input.end) - Date.parse(input.start)) / 86_400_000 + 1;
  if (days > EVENT_MAX_DAYS) throw new PlanError(`Choose ${EVENT_MAX_DAYS} days or fewer.`);
  const item = make('event', {
    startDate: input.start,
    endDate: input.end,
    data: { event: input.kind },
  });
  await db.transaction('rw', tables(db), () => putRecords(db, 'planItems', [item]));
  return item;
}

export async function removePlanItem(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction('rw', tables(db), () => softDelete(db, 'planItems', [id]));
}

export function eventsFrom(items: PlanItem[], today: string): LifeEvent[] {
  return items
    .filter((i) => i.kind === 'event' && i.startDate && i.endDate && i.endDate >= today)
    .filter((i) => EVENT_KINDS.includes(i.data.event as EventKind))
    .map((i) => ({ id: i.id, kind: i.data.event as EventKind, start: i.startDate!, end: i.endDate! }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// ---------------------------------------------------------------------------------------------
// Something hurts
// ---------------------------------------------------------------------------------------------

export async function reportPain(
  db: WorkoutDatabase,
  input: {
    area: PainArea;
    severity: PainSeverity;
    redFlags: RedFlag[];
    date: string;
    exerciseId: string | null;
  },
): Promise<PlanItem> {
  if (!PAIN_AREAS.includes(input.area)) throw new PlanError('Choose where it hurts.');
  if (!['mild', 'moderate', 'severe'].includes(input.severity))
    throw new PlanError('Choose how bad it is.');
  const item = make('pain', {
    startDate: input.date,
    endDate: null,
    data: {
      area: input.area,
      severity: input.severity,
      redFlags: input.redFlags.filter((f) => RED_FLAGS.includes(f)),
      exerciseId: input.exerciseId,
    },
  });
  await db.transaction('rw', tables(db), () => putRecords(db, 'planItems', [item]));
  return item;
}

/** Reports the weekly plan has not answered yet. */
export function painsFrom(items: PlanItem[]): PainReport[] {
  return items
    .filter((i) => i.kind === 'pain' && i.status === 'active' && i.startDate)
    .filter((i) => PAIN_AREAS.includes(i.data.area as PainArea))
    .map((i) => ({
      id: i.id,
      area: i.data.area as PainArea,
      severity: (i.data.severity as PainSeverity) ?? 'mild',
      redFlags: ((i.data.redFlags as RedFlag[] | undefined) ?? []).filter((f) =>
        RED_FLAGS.includes(f),
      ),
      date: i.startDate!,
      exerciseId: (i.data.exerciseId as string | null) ?? null,
    }));
}

// ---------------------------------------------------------------------------------------------
// Temporary changes and decisions
// ---------------------------------------------------------------------------------------------

/** How a temporary change is put back: each edit, with the value it expects to find. */
export interface Undo {
  patches: (Patch & { expectSets?: number; expectExerciseId?: string })[];
  /** The food targets as they were, and the calorie target the change set. */
  targets: {
    was: Pick<Profile, 'targetMode' | 'calorieTarget' | 'proteinTargetG' | 'carbsTargetG' | 'fatTargetG'>;
    setTo: number;
  } | null;
}

export function temporariesFrom(items: PlanItem[]): Temporary[] {
  return items
    .filter((i) => i.kind === 'temporary' && i.status === 'active' && i.endDate)
    .map((i) => ({
      id: i.id,
      cause: (i.data.cause as Temporary['cause']) ?? 'event',
      until: i.endDate!,
      muscles: (i.data.muscles as string[] | undefined) ?? [],
      calories: !!i.data.calories,
      label: (i.data.label as Text | undefined) ?? { en: 'A temporary change', hi: 'Temporary badlav' },
    }));
}

/** Monday of the most recent lighter week, if there was one. */
export function lastDeloadFrom(items: PlanItem[]): string | null {
  return (
    items
      .filter((i) => i.kind === 'temporary' && i.data.cause === 'deload' && i.startDate)
      .map((i) => i.startDate!)
      .sort()
      .at(-1) ?? null
  );
}

export interface DecisionRecord {
  id: string;
  weekStart: string;
  outcome: 'applied' | 'kept';
  at: string;
  changes: { id: string; kind: Change['kind']; title: Text; reason: Text; applied: boolean }[];
  /** The food targets after it was applied, to tell the person's later edits from the plan's. */
  targets: { kcal: number | null; proteinG: number | null } | null;
}

export function decisionsFrom(items: PlanItem[]): DecisionRecord[] {
  return items
    .filter((i) => i.kind === 'decision' && i.startDate)
    .map((i) => ({
      id: i.id,
      weekStart: i.startDate!,
      outcome: i.data.outcome === 'kept' ? ('kept' as const) : ('applied' as const),
      at: i.createdAt,
      changes: (i.data.changes as DecisionRecord['changes'] | undefined) ?? [],
      targets: (i.data.targets as DecisionRecord['targets'] | undefined) ?? null,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Whether the protein target is the person's own: typed by them, and not the number the plan
 * last set with their yes.
 */
export function ownsProtein(profile: Profile | null, decisions: DecisionRecord[]): boolean {
  if (!profile || profile.targetMode !== 'own' || profile.proteinTargetG == null) return false;
  const last = [...decisions].reverse().find((d) => d.outcome === 'applied' && d.targets);
  return last?.targets?.proteinG !== profile.proteinTargetG;
}

/** The routine as the rewrite sees it. */
export function routineSlots(
  slots: RoutineExercise[],
  exercises: Exercise[],
  days: RoutineDay[],
): { slots: Slot[]; days: DayPlan[] } {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const dayIds = new Set(days.map((d) => d.id));
  return {
    days: days.map((d) => ({ id: d.id, perWeek: Math.max(1, d.weekdays.length) })),
    slots: slots
      .filter((s) => s.deletedAt === null && dayIds.has(s.routineDayId))
      .map((s) => {
        const e = byId.get(s.exerciseId);
        return {
          id: s.id,
          dayId: s.routineDayId,
          exerciseId: s.exerciseId,
          order: s.order,
          targetSets: s.targetSets,
          restSeconds: s.restSeconds,
          primaryMuscle: e?.primaryMuscle ?? 'cardio',
          secondaryMuscles: e?.secondaryMuscles ?? [],
          category: e?.category ?? 'isolation',
        };
      }),
  };
}

const TEMP_LABEL: Record<Temporary['cause'], Text> = {
  event: { en: 'What is coming up', hi: 'Jo aane wala hai' },
  pain: { en: 'Going easy on what hurt', hi: 'Dard wali jagah par halka' },
  deload: { en: 'A lighter week', hi: 'Ek halka hafta' },
};

export interface ApplyResult {
  applied: string[];
  /** Changes that could not be made (no exercise for the muscle, the routine changed). */
  skipped: string[];
}

/**
 * The person said yes: the week's changes go into their targets and their active routine, in
 * one transaction. Temporary changes are saved with exactly how to put them back. `accept`
 * limits it to some of the changes; the rest are recorded as not applied.
 */
export async function applyDecision(
  db: WorkoutDatabase,
  decision: Decision,
  options: { accept?: string[]; label?: (change: Change) => Text | null } = {},
): Promise<ApplyResult> {
  const accept = new Set(options.accept ?? decision.changes.map((c) => c.id));
  const chosen = decision.changes.filter((c) => accept.has(c.id));
  const applied: string[] = [];
  const skipped: string[] = [];

  await db.transaction(
    'rw',
    [db.planItems, db.profiles, db.routines, db.routineDays, db.routineExercises, db.exercises, db.outbox],
    async () => {
      const profile = pickProfile(await db.profiles.toArray());
      const routine = (await db.routines.toArray()).find((r) => r.deletedAt === null && r.isActive);
      const days = routine
        ? (await db.routineDays.toArray()).filter(
            (d) => d.deletedAt === null && d.routineId === routine.id,
          )
        : [];
      const exercises = await db.exercises.toArray();
      const all = await db.routineExercises.toArray();
      const view = routineSlots(all, exercises, days);
      let slots = view.slots;
      const items = (await db.planItems.toArray()).filter(alive);

      const patchSlots = async (patches: Patch[]) => {
        for (const p of patches) {
          const changes: Partial<RoutineExercise> = {};
          if (p.targetSets !== undefined) changes.targetSets = p.targetSets;
          if (p.exerciseId !== undefined) changes.exerciseId = p.exerciseId;
          await patchRecord<RoutineExercise>(db, 'routineExercises', p.slotId, changes);
        }
        slots = slots.map((s) => {
          const p = patches.find((x) => x.slotId === s.id);
          if (!p) return s;
          const e = p.exerciseId ? exercises.find((x) => x.id === p.exerciseId) : null;
          return {
            ...s,
            targetSets: p.targetSets ?? s.targetSets,
            exerciseId: p.exerciseId ?? s.exerciseId,
            primaryMuscle: e?.primaryMuscle ?? s.primaryMuscle,
            secondaryMuscles: e?.secondaryMuscles ?? s.secondaryMuscles,
            category: e?.category ?? s.category,
          };
        });
      };

      let targets = profile
        ? {
            targetMode: profile.targetMode ?? null,
            calorieTarget: profile.calorieTarget ?? null,
            proteinTargetG: profile.proteinTargetG ?? null,
            carbsTargetG: profile.carbsTargetG ?? null,
            fatTargetG: profile.fatTargetG ?? null,
          }
        : null;
      const saveTargets = async (next: NonNullable<typeof targets>) => {
        if (!profile) return;
        await patchRecord<Profile>(db, 'profiles', profile.id, next);
        targets = next;
      };

      // 1. Temporary changes whose time is up go back, wherever the person has not since
      // changed the thing themselves.
      for (const change of chosen) {
        if (change.kind !== 'restore') continue;
        const item = items.find((i) => i.id === change.temporaryId);
        const undo = item?.data.undo as Undo | undefined;
        if (!item || !undo) {
          skipped.push(change.id);
          continue;
        }
        const back = undo.patches.filter((p) => {
          const now = slots.find((s) => s.id === p.slotId);
          if (!now) return false;
          if (p.expectSets !== undefined && now.targetSets !== p.expectSets) return false;
          if (p.expectExerciseId !== undefined && now.exerciseId !== p.expectExerciseId) return false;
          return true;
        });
        await patchSlots(back.map(({ slotId, targetSets, exerciseId }) => ({ slotId, targetSets, exerciseId })));
        if (undo.targets && targets && targets.calorieTarget === undo.targets.setTo)
          await saveTargets({ ...targets, ...undo.targets.was });
        await patchRecord<PlanItem>(db, 'planItems', item.id, { status: 'done' });
        applied.push(change.id);
      }

      // 2. The rest, in groups: what goes back together is saved together.
      const groups = new Map<string, Change[]>();
      for (const change of chosen) {
        if (change.kind === 'restore') continue;
        const temporary = change.until !== null;
        const cause = change.cause === 'pain' ? 'pain' : change.kind === 'deload' ? 'deload' : 'event';
        const key = temporary ? `${cause}:${change.until}` : 'keep';
        groups.set(key, [...(groups.get(key) ?? []), change]);
      }
      const order = [...groups.keys()].sort((a, b) => Number(a === 'keep') - Number(b === 'keep'));
      for (const key of order) {
        const group = groups.get(key)!;
        const temporary = key !== 'keep';
        const before = slots;
        const routineChanges = group.filter((c) => c.kind !== 'calories' && c.kind !== 'protein');
        const result = rewriteRoutine(slots, view.days, routineChanges);
        if (!routine) result.unapplied.push(...routineChanges.map((c) => c.id));
        await patchSlots(result.patches);
        let targetUndo: Undo['targets'] = null;
        for (const change of group) {
          if (change.kind !== 'calories' && change.kind !== 'protein') continue;
          if (!targets || !profile) {
            skipped.push(change.id);
            continue;
          }
          const was = { ...targets };
          const calculated = targets.targetMode !== 'own';
          const next = {
            ...targets,
            targetMode: 'own' as const,
            // Targets that were calculated follow the new calories instead of old typed numbers.
            carbsTargetG: calculated ? null : targets.carbsTargetG,
            fatTargetG: calculated ? null : targets.fatTargetG,
            ...(change.kind === 'calories'
              ? { calorieTarget: change.to, proteinTargetG: targets.proteinTargetG ?? null }
              : { proteinTargetG: change.to }),
          };
          await saveTargets(next);
          if (temporary && change.kind === 'calories') targetUndo = { was, setTo: change.to };
          applied.push(change.id);
        }
        for (const change of routineChanges) {
          if (result.unapplied.includes(change.id)) skipped.push(change.id);
          else applied.push(change.id);
        }
        if (temporary) {
          const first = group[0]!;
          const cause: Temporary['cause'] = key.startsWith('pain')
            ? 'pain'
            : key.startsWith('deload')
              ? 'deload'
              : 'event';
          const undo: Undo = {
            patches: result.undo.map((u) => {
              const after = slots.find((s) => s.id === u.slotId)!;
              const was = before.find((s) => s.id === u.slotId)!;
              return {
                ...u,
                ...(u.targetSets !== undefined ? { expectSets: after.targetSets } : {}),
                ...(u.exerciseId !== undefined && was.exerciseId !== after.exerciseId
                  ? { expectExerciseId: after.exerciseId }
                  : {}),
              };
            }),
            targets: targetUndo,
          };
          if (undo.patches.length || undo.targets) {
            const item = make('temporary', {
              startDate: decision.weekStart,
              endDate: first.until,
              data: {
                cause,
                muscles: group.flatMap((c) => (c.kind === 'sets' ? [c.muscle] : [])),
                calories: !!targetUndo,
                label: options.label?.(first) ?? TEMP_LABEL[cause],
                undo,
              },
            });
            await putRecords(db, 'planItems', [item]);
          }
        }
      }

      // 3. Pain reports have been answered, and the decision is on record.
      for (const pain of items.filter((i) => i.kind === 'pain' && i.status === 'active'))
        await patchRecord<PlanItem>(db, 'planItems', pain.id, { status: 'done' });
      const record = make('decision', {
        startDate: decision.weekStart,
        endDate: null,
        status: 'done',
        data: {
          outcome: 'applied',
          changes: decision.changes.map((c) => ({
            id: c.id,
            kind: c.kind,
            title: c.title,
            reason: c.reason,
            applied: applied.includes(c.id),
          })),
          targets: targets
            ? { kcal: targets.calorieTarget, proteinG: targets.proteinTargetG }
            : null,
        },
      });
      await putRecords(db, 'planItems', [record]);
    },
  );
  return { applied, skipped };
}

/** The person kept their plan: nothing changes, and the week is not asked about again. */
export async function keepPlan(db: WorkoutDatabase, decision: Decision): Promise<void> {
  await db.transaction('rw', tables(db), async () => {
    const items = (await db.planItems.toArray()).filter(alive);
    // A pain report that only brought a warning has still been seen.
    for (const pain of items.filter((i) => i.kind === 'pain' && i.status === 'active'))
      await patchRecord<PlanItem>(db, 'planItems', pain.id, { status: 'done' });
    await putRecords(db, 'planItems', [
      make('decision', {
        startDate: decision.weekStart,
        endDate: null,
        status: 'done',
        data: {
          outcome: 'kept',
          changes: decision.changes.map((c) => ({
            id: c.id,
            kind: c.kind,
            title: c.title,
            reason: c.reason,
            applied: false,
          })),
          targets: null,
        },
      }),
    ]);
  });
}

// ---------------------------------------------------------------------------------------------
// What Macrotrophy AI knows
// ---------------------------------------------------------------------------------------------

export const MEMORY_MAX_CHARS = 160;
export const MEMORY_MAX_ITEMS = 40;

export interface MemoryNote {
  id: string;
  text: string;
  /** chat: the person confirmed it in a chat. typed: they wrote it in Settings. */
  source: 'chat' | 'typed';
  at: string;
}

export function memoryFrom(items: PlanItem[]): MemoryNote[] {
  return items
    .filter((i) => i.kind === 'memory' && typeof i.data.text === 'string')
    .map((i) => ({
      id: i.id,
      text: i.data.text as string,
      source: i.data.source === 'chat' ? ('chat' as const) : ('typed' as const),
      at: i.createdAt,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export async function addMemory(
  db: WorkoutDatabase,
  text: string,
  source: MemoryNote['source'] = 'typed',
): Promise<PlanItem> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) throw new PlanError('Write what it should remember.');
  if (clean.length > MEMORY_MAX_CHARS)
    throw new PlanError(`Keep it to ${MEMORY_MAX_CHARS} characters.`);
  const item = make('memory', { startDate: null, endDate: null, data: { text: clean, source } });
  await db.transaction('rw', tables(db), async () => {
    const count = (await db.planItems.toArray()).filter((i) => alive(i) && i.kind === 'memory').length;
    if (count >= MEMORY_MAX_ITEMS)
      throw new PlanError(`It can hold ${MEMORY_MAX_ITEMS} things. Delete one first.`);
    await putRecords(db, 'planItems', [item]);
  });
  return item;
}

export async function editMemory(db: WorkoutDatabase, id: string, text: string): Promise<void> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) throw new PlanError('Write what it should remember.');
  if (clean.length > MEMORY_MAX_CHARS)
    throw new PlanError(`Keep it to ${MEMORY_MAX_CHARS} characters.`);
  await db.transaction('rw', tables(db), async () => {
    const item = await db.planItems.get(id);
    if (!item) return;
    await patchRecord<PlanItem>(db, 'planItems', id, { data: { ...item.data, text: clean } });
  });
}

// ---------------------------------------------------------------------------------------------
// Meal plans
// ---------------------------------------------------------------------------------------------

/** Saves the week's meal plan, replacing an earlier one for the same week. */
export async function saveMealPlan(
  db: WorkoutDatabase,
  weekStart: string,
  data: Record<string, unknown>,
): Promise<PlanItem> {
  const item = make('meal_plan', { startDate: weekStart, endDate: null, data });
  await db.transaction('rw', tables(db), async () => {
    const old = (await db.planItems.toArray()).filter(
      (i) => alive(i) && i.kind === 'meal_plan' && i.startDate === weekStart,
    );
    await softDelete(
      db,
      'planItems',
      old.map((i) => i.id),
    );
    await putRecords(db, 'planItems', [item]);
  });
  return item;
}

export function mealPlanFrom(items: PlanItem[], weekStart: string): PlanItem | null {
  return (
    items
      .filter((i) => i.kind === 'meal_plan' && i.startDate === weekStart)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1) ?? null
  );
}
