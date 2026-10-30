/** Which release announcement this device has seen. Device-only, like other display state. */
export const RELEASE_ID = '2026-10-fresh-look';
const KEY = 'overload.whatsNew';

export function seenRelease(): boolean {
  try {
    return localStorage.getItem(KEY) === RELEASE_ID;
  } catch {
    return true; // Without storage, never nag on every open.
  }
}

export function markReleaseSeen() {
  try {
    localStorage.setItem(KEY, RELEASE_ID);
  } catch {
    // Private windows: it simply shows again next time.
  }
}
