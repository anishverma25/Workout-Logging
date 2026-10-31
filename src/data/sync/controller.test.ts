import { WorkoutDatabase } from '../db';
import { addBodyWeight } from '../repositories/bodyweight';
import { SyncController } from './controller';
import type { RemoteStore } from './remote';

describe('SyncController', () => {
  const remote: RemoteStore = {
    upsert: vi.fn(async () => undefined),
    pull: vi.fn(async () => []),
  };
  let db: WorkoutDatabase;
  let onLine = true;
  vi.stubGlobal('navigator', {
    get onLine() {
      return onLine;
    },
  });

  beforeEach(async () => {
    db = new WorkoutDatabase(`controller-${Math.random()}`, { syncEnabled: true });
    await db.open();
    vi.mocked(remote.upsert).mockClear();
  });
  afterEach(async () => {
    await db.delete();
  });

  it('does not try the network while offline, and says so', async () => {
    onLine = false;
    const controller = new SyncController();
    await controller.start(db, remote, 'user-1');
    await addBodyWeight(db, { weight: 80, unit: 'kg', date: '2026-09-01', note: null });
    await controller.syncNow();
    expect(controller.getState().phase).toBe('offline');
    expect(remote.upsert).not.toHaveBeenCalled();

    onLine = true;
    await controller.syncNow();
    expect(controller.getState()).toMatchObject({ phase: 'idle', pending: 0 });
    expect(remote.upsert).toHaveBeenCalledTimes(1);
    controller.stop();
  });
});
