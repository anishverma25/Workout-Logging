import { decideWeek, type Change, type Decision } from '@/domain/brain/engine';
import { mondayKey } from '@/domain/brain/sim';
import { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import {
  addEvent,
  addMemory,
  applyDecision,
  decisionsFrom,
  editMemory,
  eventsFrom,
  keepPlan,
  memoryFrom,
  ownsProtein,
  painsFrom,
  PlanError,
  planItems,
  removePlanItem,
  reportPain,
  routineSlots,
  temporariesFrom,
} from './plan';
import { saveProfile } from './profile';
import { createRoutineFromTemplate } from './routines';
import { ensureSystemExercises, pickProfile } from './training';
import { plannedMuscleSets } from '@/domain/brain/rewrite';

let db: WorkoutDatabase;
beforeEach(async () => {
  db = new WorkoutDatabase(`plan-${Math.random()}`, { syncEnabled: true });
  await db.open();
  await ensureSystemExercises(db);
  await saveProfile(db, { displayName: 'Riya', goal: 'fat_loss', experience: 'intermediate', birthDate: null });
  await createRoutineFromTemplate(db, 'ppl');
});
afterEach(() => db.delete());

const text = { en: 'x', hi: 'x' };
const base = { title: text, reason: text, topic: 'adaptive-plan' };
const decision = (changes: Change[]): Decision => ({
  weekStart: mondayKey(10),
  stage: { learning: false, week: 6, of: 6 },
  maintenance: null,
  changes,
  holds: [],
  warnings: [],
  notes: [],
});

async function routine() {
  const active = (await db.routines.toArray()).find((r) => r.isActive)!;
  const days = (await db.routineDays.toArray()).filter((d) => d.routineId === active.id && d.deletedAt === null);
  const all = await db.routineExercises.toArray();
  return routineSlots(all, await db.exercises.toArray(), days);
}
const sets = async () => plannedMuscleSets((await routine()).slots, (await routine()).days);
const profile = async () => pickProfile(await db.profiles.toArray())!;

describe('what the plan remembers', () => {
  it('keeps events with their dates and refuses impossible ones', async () => {
    const e = await addEvent(db, { kind: 'exams', start: '2026-11-16', end: '2026-11-22' });
    expect(eventsFrom(await planItems(db), '2026-11-12')).toEqual([{ id: e.id, kind: 'exams', start: '2026-11-16', end: '2026-11-22' }]);
    expect(eventsFrom(await planItems(db), '2026-11-23')).toEqual([]);
    expect(await db.outbox.get(`planItems:${e.id}`)).toBeDefined();
    await expect(addEvent(db, { kind: 'exams', start: '2026-11-20', end: '2026-11-16' })).rejects.toBeInstanceOf(PlanError);
    await expect(addEvent(db, { kind: 'travel', start: '2026-11-01', end: '2027-03-01' })).rejects.toThrow(/45 days/);
    await removePlanItem(db, e.id);
    expect(eventsFrom(await planItems(db), '2026-11-12')).toEqual([]);
  });

  it('keeps what Macrotrophy AI may know, editable and bounded', async () => {
    const m = await addMemory(db, '  I train at  6 am before class ');
    expect(memoryFrom(await planItems(db))).toMatchObject([{ text: 'I train at 6 am before class', source: 'typed' }]);
    await editMemory(db, m.id, 'I train at 7 am');
    expect(memoryFrom(await planItems(db))[0]!.text).toBe('I train at 7 am');
    await expect(addMemory(db, 'x'.repeat(200))).rejects.toThrow(/160/);
    await expect(addMemory(db, '   ')).rejects.toBeInstanceOf(PlanError);
  });
});

describe('applying a week', () => {
  it('sets the calorie target and a muscle’s sets, and records the decision', async () => {
    await db.profiles.update((await profile()).id, { targetMode: 'own', calorieTarget: 1800, proteinTargetG: 130 });
    const before = await sets();
    const d = decision([
      { ...base, id: 'calories', kind: 'calories', from: 1800, to: 1650, cause: 'pace', until: null },
      { ...base, id: 'sets:chest', kind: 'sets', muscle: 'chest', from: Math.round(before.chest!), to: Math.round(before.chest!) + 2, cause: 'progress', until: null },
    ]);
    const r = await applyDecision(db, d);
    expect(r).toEqual({ applied: ['calories', 'sets:chest'], skipped: [] });
    expect(await profile()).toMatchObject({ calorieTarget: 1650, proteinTargetG: 130, targetMode: 'own' });
    expect((await sets()).chest! - before.chest!).toBe(2);
    const [rec] = decisionsFrom(await planItems(db));
    expect(rec).toMatchObject({ weekStart: mondayKey(10), outcome: 'applied', targets: { kcal: 1650, proteinG: 130 } });
    expect(rec!.changes.every((c) => c.applied)).toBe(true);
    // The protein target is still the plan's to move; typing a new one makes it the person's.
    expect(ownsProtein(await profile(), decisionsFrom(await planItems(db)))).toBe(false);
    await db.profiles.update((await profile()).id, { proteinTargetG: 150 });
    expect(ownsProtein(await profile(), decisionsFrom(await planItems(db)))).toBe(true);
  });

  it('a lighter week is saved with how to put it back, and goes back exactly', async () => {
    const before = (await routine()).slots.map((s) => [s.id, s.targetSets]);
    await applyDecision(db, decision([{ ...base, id: 'deload', kind: 'deload', share: 0.6, cause: 'deload', until: mondayKey(11) }]));
    const light = (await routine()).slots;
    expect(light.every((s) => s.targetSets >= 1)).toBe(true);
    expect(light.reduce((n, s) => n + s.targetSets, 0)).toBeLessThan(before.reduce((n, [, v]) => n + (v as number), 0));
    const [temp] = temporariesFrom(await planItems(db));
    expect(temp).toMatchObject({ cause: 'deload', until: mondayKey(11), calories: false });

    // The person changes one exercise themselves during the week: theirs is kept.
    const mine = light[0]!;
    await db.routineExercises.update(mine.id, { targetSets: 5 });
    await applyDecision(db, decision([{ ...base, id: `restore:${temp!.id}`, kind: 'restore', temporaryId: temp!.id, cause: 'restore', until: null }]));
    const after = new Map((await routine()).slots.map((s) => [s.id, s.targetSets]));
    for (const [id, was] of before) expect(after.get(id as string)).toBe(id === mine.id ? 5 : was);
    expect(temporariesFrom(await planItems(db))).toEqual([]);
  });

  it('exam week: maintenance calories go back to the cut afterwards', async () => {
    await db.profiles.update((await profile()).id, { targetMode: 'own', calorieTarget: 1800, proteinTargetG: 130 });
    await applyDecision(db, decision([{ ...base, id: 'calories', kind: 'calories', from: 1800, to: 2250, cause: 'event', until: mondayKey(11) }]));
    expect((await profile()).calorieTarget).toBe(2250);
    const [temp] = temporariesFrom(await planItems(db));
    expect(temp).toMatchObject({ cause: 'event', calories: true });
    await applyDecision(db, decision([{ ...base, id: `restore:${temp!.id}`, kind: 'restore', temporaryId: temp!.id, cause: 'restore', until: null }]));
    expect(await profile()).toMatchObject({ calorieTarget: 1800, targetMode: 'own' });
  });

  it('a sore shoulder: the swap and the trim go in together and the report is answered', async () => {
    await reportPain(db, { area: 'shoulder', severity: 'mild', redFlags: [], date: '2026-11-12', exerciseId: null });
    const { slots, days } = await routine();
    const items = await planItems(db);
    const ids = [...new Set(slots.map((s) => s.exerciseId))];
    const exercises = await db.exercises.toArray();
    const keyOf = new Map<string, string>();
    for (const key of ['overhead-press', 'barbell-bench-press', 'machine-shoulder-press', 'machine-chest-press', 'incline-dumbbell-press', 'dips', 'triceps-rope-pushdown', 'seated-dumbbell-press'])
      keyOf.set(exerciseIdFor(key), key);
    const d = decideWeek({
      nextWeekStart: mondayKey(10),
      weeks: [],
      model: { weeksLogged: 0, stage: { learning: true, week: 0, of: 6 }, maintenance: null, findings: [], lifts: {} },
      person: { goal: 'fat_loss', experience: 'intermediate', weightKg: 64, bmrKcal: 1400, targetKg: null, ownProtein: false },
      plan: { kcal: null, proteinG: null, muscleSets: plannedMuscleSets(slots, days), exerciseIds: ids, sessionMinutes: 60 },
      events: [],
      pains: painsFrom(items),
      stalls: [],
      temporaries: [],
      lastDeload: null,
      exercise: {
        name: (id) => exercises.find((e) => e.id === id)?.name ?? id,
        keyOf: (id) => keyOf.get(id) ?? null,
        idOf: (key) => exerciseIdFor(key),
      },
    });
    expect(d.changes.some((c) => c.kind === 'swap')).toBe(true);
    const before = await sets();
    const r = await applyDecision(db, d);
    expect(r.skipped).toEqual([]);
    expect((await sets()).shoulders!).toBeLessThan(before.shoulders!);
    expect(painsFrom(await planItems(db))).toEqual([]);
    expect(temporariesFrom(await planItems(db))).toMatchObject([{ cause: 'pain', muscles: expect.arrayContaining(['shoulders']) }]);
  });

  it('keeping the plan changes nothing and is remembered', async () => {
    const before = JSON.stringify((await routine()).slots);
    await keepPlan(db, decision([{ ...base, id: 'calories', kind: 'calories', from: 1800, to: 1650, cause: 'pace', until: null }]));
    expect(JSON.stringify((await routine()).slots)).toBe(before);
    expect(decisionsFrom(await planItems(db))).toMatchObject([{ outcome: 'kept', changes: [{ applied: false }] }]);
  });

  it('says so when a change cannot be made', async () => {
    const r = await applyDecision(db, decision([{ ...base, id: 'sets:neck', kind: 'sets', muscle: 'neck', from: 0, to: 2, cause: 'progress', until: null }]));
    expect(r).toEqual({ applied: [], skipped: ['sets:neck'] });
  });
});
