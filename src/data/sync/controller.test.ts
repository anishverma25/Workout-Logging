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

  it('a local change pushes without asking every table again', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    try {
      onLine = true;
      vi.mocked(remote.pull).mockClear();
      const controller = new SyncController();
      await controller.start(db, remote, 'user-1');
      await vi.waitFor(() => expect(controller.getState().phase).toBe('idle'));
      const pullsAtStart = vi.mocked(remote.pull).mock.calls.length;
      expect(pullsAtStart).toBeGreaterThan(0);

      await addBodyWeight(db, { weight: 81, unit: 'kg', date: '2026-09-02', note: null });
      await vi.waitFor(() => expect(controller.getState().pending).toBe(1));
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.waitFor(() =>
        expect(controller.getState()).toMatchObject({ phase: 'idle', pending: 0 }),
      );
      expect(remote.upsert).toHaveBeenCalledTimes(1);
      expect(vi.mocked(remote.pull).mock.calls.length).toBe(pullsAtStart);

      // Asking (Sync now, online, visible) always pulls.
      await controller.syncNow();
      expect(vi.mocked(remote.pull).mock.calls.length).toBe(pullsAtStart * 2);
      controller.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives changes the server refused one more try after an update', async () => {
    const { retryRejectedOncePerVersion, MAX_ATTEMPTS } = await import('./engine');
    await addBodyWeight(db, { weight: 80, unit: 'kg', date: '2026-09-01', note: null });
    await db.outbox.toCollection().modify((e) => {
      e.attempts = MAX_ATTEMPTS;
    });
    expect(await retryRejectedOncePerVersion(db, 'v2')).toBe(true);
    expect((await db.outbox.toArray())[0]!.attempts).toBe(0);
    await db.outbox.toCollection().modify((e) => {
      e.attempts = MAX_ATTEMPTS;
    });
    // Same version: left alone, so a change that keeps failing is not retried forever.
    expect(await retryRejectedOncePerVersion(db, 'v2')).toBe(false);
    expect((await db.outbox.toArray())[0]!.attempts).toBe(MAX_ATTEMPTS);
  });
});
