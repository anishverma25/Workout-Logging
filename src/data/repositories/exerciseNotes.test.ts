import { WorkoutDatabase } from '../db';
import { exerciseIdFor } from '../library/exercises';
import { pinnedNotesByExercise, setPinnedExerciseNote } from './exerciseNotes';
import { newRecordMeta } from './write';

let db: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`pins-${++n}`, { syncEnabled: true });
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

const BENCH = exerciseIdFor('barbell-bench-press');
const SQUAT = exerciseIdFor('back-squat');

describe('notes pinned to an exercise', () => {
  it('pins, edits and removes one note per exercise, queued for sync', async () => {
    await setPinnedExerciseNote(db, BENCH, '  Grip on the rings  ');
    let notes = await pinnedNotesByExercise(db, [BENCH, SQUAT]);
    expect(notes.get(BENCH)?.note).toBe('Grip on the rings');
    expect(notes.has(SQUAT)).toBe(false);

    await setPinnedExerciseNote(db, BENCH, 'Grip one finger out');
    const live = (await db.exerciseNotes.toArray()).filter((x) => x.deletedAt === null);
    expect(live).toHaveLength(1);
    expect(live[0]!.note).toBe('Grip one finger out');

    await setPinnedExerciseNote(db, BENCH, '   ');
    notes = await pinnedNotesByExercise(db, [BENCH]);
    expect(notes.has(BENCH)).toBe(false);
    expect((await db.outbox.toArray()).filter((o) => o.table === 'exerciseNotes').length).toBe(1);
  });

  it('keeps the newest when two devices each pinned one, and tidies the other away', async () => {
    const old = { ...newRecordMeta('user', '2026-11-01T10:00:00.000Z'), exerciseId: BENCH, note: 'Old' };
    const newer = {
      ...newRecordMeta('user', '2026-11-02T10:00:00.000Z'),
      exerciseId: BENCH,
      note: 'Newer',
    };
    await db.exerciseNotes.bulkPut([old, newer]);
    expect((await pinnedNotesByExercise(db, [BENCH])).get(BENCH)?.note).toBe('Newer');
    await setPinnedExerciseNote(db, BENCH, 'Final');
    const live = (await db.exerciseNotes.toArray()).filter((x) => x.deletedAt === null);
    expect(live.map((x) => x.note)).toEqual(['Final']);
  });
});
