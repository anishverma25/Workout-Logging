import { OFF_STATE, type SyncState } from './controller';
import { describeSync } from './describe';

const base: SyncState = { ...OFF_STATE, phase: 'idle' };
const now = new Date('2026-09-10T12:00:00');

describe('describeSync', () => {
  it('never claims a backup without an account', () => {
    const d = describeSync(OFF_STATE, false, now);
    expect(d.tone).toBe('local');
    expect(d.detail).toMatch(/Not backed up/);
  });

  it('says synced only when nothing is waiting and the server confirmed', () => {
    expect(describeSync({ ...base, lastSyncedAt: '2026-09-10T11:58:00' }, true, now)).toMatchObject(
      {
        tone: 'synced',
        title: 'Synced to your account',
      },
    );
    // Pending changes mean "saved on this device", even if an earlier sync succeeded.
    const pending = describeSync(
      { ...base, pending: 3, lastSyncedAt: '2026-09-10T11:58:00' },
      true,
      now,
    );
    expect(pending).toMatchObject({ tone: 'pending', title: 'Saved on this device' });
    expect(pending.detail).toBe('3 changes waiting to sync to your account.');
    // Signed in but never confirmed yet.
    expect(describeSync(base, true, now).tone).toBe('pending');
  });

  it('explains offline and failing states without losing data', () => {
    expect(describeSync({ ...base, phase: 'offline', pending: 1 }, true, now).detail).toBe(
      '1 change saved on this device. It will sync when you are back online.',
    );
    expect(describeSync({ ...base, phase: 'error', pending: 2 }, true, now).tone).toBe('problem');
    expect(describeSync({ ...base, pending: 2, rejected: 2 }, true, now).title).toBe(
      '2 changes could not be saved to your account',
    );
  });
});
