/**
 * Whether this device has already seen the welcome tour. Kept in local storage, not in a
 * database, because it decides where a signed-out visitor lands before any database is open,
 * and it must survive switching between the signed-out and account databases.
 *
 * Losing it is harmless: the worst case is seeing the tour again, which anyone can leave with
 * the Sign in link in its header.
 */

const KEY = 'overload.seenTour';

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // Private windows and blocked storage: treat it as a first visit.
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Nothing to do: the tour simply shows again next time.
  }
}
