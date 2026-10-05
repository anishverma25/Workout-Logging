import { formatRelativeDayInline } from '@/lib/dates';
import { pluralize } from '@/lib/format';
import type { SyncState } from './controller';

export type SyncTone = 'local' | 'pending' | 'synced' | 'problem';

export interface SyncDescription {
  tone: SyncTone;
  title: string;
  detail: string;
}

const changes = (n: number) => pluralize(n, 'change');

function syncedAt(iso: string, now: Date) {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${formatRelativeDayInline(at, now)} at ${time}`;
}

/**
 * The words the app uses for where data is. "Synced" appears only after the server confirmed
 * every change; until then data is described as saved on this device.
 */
export function describeSync(
  state: SyncState,
  signedIn: boolean,
  now = new Date(),
): SyncDescription {
  if (!signedIn || state.phase === 'off') {
    return {
      tone: 'local',
      title: 'Saved on this device',
      detail: 'Not backed up. Sign in to keep a copy in your account and use it on other devices.',
    };
  }
  const waiting = state.pending - state.rejected;
  if (state.rejected > 0) {
    return {
      tone: 'problem',
      title: `${changes(state.rejected)} could not be saved to your account`,
      detail: 'They are kept on this device. Try again, and if it keeps failing, contact support.',
    };
  }
  if (state.phase === 'offline') {
    return {
      tone: 'pending',
      title: 'Offline',
      detail:
        waiting > 0
          ? `${changes(waiting)} saved on this device. ${waiting === 1 ? 'It' : 'They'} will sync when you are back online.`
          : 'Everything you log is saved on this device and will sync when you are back online.',
    };
  }
  if (state.phase === 'error') {
    return {
      tone: 'problem',
      title: 'Could not reach your account',
      detail:
        waiting > 0
          ? `${changes(waiting)} saved on this device. Trying again automatically.`
          : 'Your data is saved on this device. Trying again automatically.',
    };
  }
  if (waiting > 0) {
    return {
      tone: 'pending',
      title: state.phase === 'syncing' ? 'Syncing' : 'Saved on this device',
      detail: `${changes(waiting)} waiting to sync to your account.`,
    };
  }
  if (state.lastSyncedAt) {
    return {
      tone: 'synced',
      title: 'Synced to your account',
      detail: `Last synced ${syncedAt(state.lastSyncedAt, now)}.`,
    };
  }
  return {
    tone: 'pending',
    title: 'Connecting to your account',
    detail: 'Your data is saved on this device while the first sync runs.',
  };
}
