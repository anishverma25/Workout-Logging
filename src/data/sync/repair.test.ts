import { createTestServer, type TestServer } from '@/test/server';
import { WorkoutDatabase } from '../db';
import { addBodyWeight } from '../repositories/bodyweight';
import { ensureSystemExercises } from '../repositories/training';
import { META_KEYS } from '../repositories/meta';
import {
  pull,
  redownloadAccount,
  retrySkipped,
  retrySkippedOncePerVersion,
  skippedRows,
  syncOnce,
} from './engine';

/** Batch 18 (S1, S2): rows are never skipped for good, and an account can be fetched again. */
let server: TestServer;
let user: string;
let n = 0;
const open: WorkoutDatabase[] = [];

async function device(): Promise<WorkoutDatabase> {
  const db = new WorkoutDatabase(`repair-${++n}`, { syncEnabled: true });
  await db.open();
  await ensureSystemExercises(db);
  open.push(db);
  return db;
}

/** Makes a server row this app version cannot read (as a newer version's value would be). */
async function breakRow(id: string) {
  await server.pg.query(
    `alter table public.body_weight drop constraint if exists body_weight_entered_unit_check`,
  );
  await server.pg.query(`update public.body_weight set entered_unit = 'st' where id = $1`, [id]);
}
async function fixRow(id: string) {
  await server.pg.query(`update public.body_weight set entered_unit = 'kg' where id = $1`, [id]);
}

beforeAll(async () => {
  server = await createTestServer();
  user = await server.createUser('repair@example.com');
}, 30_000);

afterAll(async () => {
  for (const db of open) await db.delete();
  await server.close();
});

describe('rows a phone could not read (S1)', () => {
  it('are remembered, fetched again after an update, and never block the rest', async () => {
    const phone = await device();
    const remote = server.remoteFor(user);
    await addBodyWeight(phone, { weight: 80, unit: 'kg', date: '2026-09-01', note: null });
    await addBodyWeight(phone, { weight: 81, unit: 'kg', date: '2026-09-02', note: null });
    await syncOnce(phone, remote, user);
    const [bad, good] = await phone.bodyWeights.orderBy('measuredAt').toArray();
    await breakRow(bad!.id);

    const laptop = await device();
    await pull(laptop, remote);
    // The readable row arrived; the other is remembered, and the cursor still moved on.
    expect((await laptop.bodyWeights.toArray()).map((w) => w.id)).toEqual([good!.id]);
    expect(await skippedRows(laptop)).toEqual([{ table: 'bodyWeights', key: bad!.id }]);
    expect(await laptop.meta.get(`${META_KEYS.syncCursor}body_weight`)).toBeTruthy();

    // Still unreadable: stays listed.
    expect(await retrySkipped(laptop, remote)).toBe(0);
    expect(await skippedRows(laptop)).toHaveLength(1);

    // A newer version can read it (here: the row is fixed); the next update fetches it.
    await fixRow(bad!.id);
    expect(await retrySkippedOncePerVersion(laptop, remote, 'v2')).toBe(1);
    expect(await laptop.bodyWeights.count()).toBe(2);
    expect(await skippedRows(laptop)).toEqual([]);
    // Once per version only.
    expect(await retrySkippedOncePerVersion(laptop, remote, 'v2')).toBe(0);
  });

  it('a row the server no longer has is dropped from the list', async () => {
    const phone = await device();
    const remote = server.remoteFor(user);
    await phone.meta.put({
      key: 'sync.skipped',
      value: [{ table: 'bodyWeights', key: '00000000-0000-4000-8000-000000000099' }],
      updatedAt: new Date().toISOString(),
    } as never);
    await retrySkipped(phone, remote);
    expect(await skippedRows(phone)).toEqual([]);
  });
});

describe('Download my account again (S2)', () => {
  it('fetches everything again without removing anything on the phone', async () => {
    const phone = await device();
    const remote = server.remoteFor(user);
    await syncOnce(phone, remote, user);
    const before = await phone.bodyWeights.count();
    expect(before).toBeGreaterThan(0);
    // A row lost on the phone (as if the database had been damaged) comes back.
    const lost = (await phone.bodyWeights.toArray())[0]!;
    await phone.bodyWeights.delete(lost.id);
    // A note only on this phone, never synced, is kept.
    await phone.meta.put({ key: 'local.only', value: 1, updatedAt: '' } as never);

    const r = await redownloadAccount(phone, remote);
    expect(r).toMatchObject({ ok: true });
    expect(await phone.bodyWeights.count()).toBe(before);
    expect(await phone.meta.get('local.only')).toBeTruthy();
  });

  it('is refused while changes are waiting to be sent', async () => {
    const phone = await device();
    await addBodyWeight(phone, { weight: 82, unit: 'kg', date: '2026-09-03', note: null });
    expect(await redownloadAccount(phone, server.remoteFor(user))).toEqual({
      ok: false,
      reason: 'pending',
    });
    expect(await phone.bodyWeights.count()).toBe(1);
  });
});
