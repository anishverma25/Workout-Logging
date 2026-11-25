/** Which release announcement this device has seen. Device-only, like other display state. */
export const RELEASE_ID = '2026-11-community';
/**
 * When this release shipped. An account made at or after this moment never used the app before
 * it, so the announcement of what changed means nothing to it and is not shown.
 */
export const RELEASE_AT = '2026-11-26T00:00:00Z';
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

/** True when an account was created after this release: it has nothing "new" to be shown. */
export function newerThanRelease(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const made = Date.parse(createdAt);
  return Number.isFinite(made) && made >= Date.parse(RELEASE_AT);
}
