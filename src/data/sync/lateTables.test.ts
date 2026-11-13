import { WorkoutDatabase } from '../db';
import { addBodyWeight } from '../repositories/bodyweight';
import { addEvent } from '../repositories/plan';
import { outboxCounts, syncOnce } from './engine';
import type { ServerRow } from './mapping';
import { isMissingTable, RemoteError, type RemoteStore, type RemoteTable } from './remote';

/**
 * A table added after release (plan_items): if the server has not had its migration yet, its
 * rows wait on the phone and everything else keeps syncing. Nothing is set aside or lost, and
 * the rows go up as soon as the table exists.
 */

class Server implements RemoteStore {
  hasPlanItems = false;
  rows = new Map<string, ServerRow[]>();
  private missing() {
    return new RemoteError("Could not find the table 'public.plan_items' in the schema cache", {
      transient: false,
      code: 'PGRST205',
    });
  }
  async upsert(table: RemoteTable, rows: ServerRow[]) {
    if (table === 'plan_items' && !this.hasPlanItems) throw this.missing();
    this.rows.set(table, [...(this.rows.get(table) ?? []), ...rows]);
  }
  async pull(table: RemoteTable) {
    if (table === 'plan_items' && !this.hasPlanItems) throw this.missing();
    return [];
  }
}

let db: WorkoutDatabase;
beforeEach(async () => {
  db = new WorkoutDatabase(`late-${Math.random()}`, { syncEnabled: true });
  await db.open();
});
afterEach(() => db.delete());

it('recognises a missing table', () => {
  expect(isMissingTable({ code: 'PGRST205', message: '' })).toBe(true);
  expect(isMissingTable({ code: '42P01', message: 'relation "public.plan_items" does not exist' })).toBe(true);
  expect(isMissingTable({ code: '23514', message: 'check constraint' })).toBe(false);
});

it('keeps syncing everything else, and sends the waiting rows once the table exists', async () => {
  const server = new Server();
  await addBodyWeight(db, { weight: 70, unit: 'kg', date: '2026-11-12', note: null });
  const event = await addEvent(db, { kind: 'exams', start: '2026-11-16', end: '2026-11-22' });

  for (let round = 0; round < 6; round++) {
    const r = await syncOnce(db, server, 'user-1');
    expect(r.rejected).toBe(0);
  }
  expect(server.rows.get('body_weight')).toHaveLength(1);
  expect(server.rows.get('plan_items')).toBeUndefined();
  // Still waiting, never given up on.
  expect(await outboxCounts(db)).toEqual({ pending: 1, rejected: 0 });
  expect((await db.outbox.get(`planItems:${event.id}`))!.attempts).toBe(0);

  server.hasPlanItems = true;
  await syncOnce(db, server, 'user-1');
  expect(server.rows.get('plan_items')).toMatchObject([{ id: event.id, kind: 'event', data: { event: 'exams' } }]);
  expect(await outboxCounts(db)).toEqual({ pending: 0, rejected: 0 });
});
