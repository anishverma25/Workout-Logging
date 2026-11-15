const OLD_KEY = 'overload.wrapped.seen';
const KEY = (account: string | null) => (account ? `${OLD_KEY}.${account}` : OLD_KEY);

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The recaps opened on this phone by this account, so the Home card shows once for each (C5:
 * kept per account, so a second account on the phone still sees its own). Recaps opened before
 * this change, under the shared key, count as seen.
 */
export function wrappedSeen(account: string | null): string[] {
  return [...new Set([...read(KEY(account)), ...read(OLD_KEY)])];
}

export function markWrappedSeen(account: string | null, key: string) {
  try {
    const list = [...new Set([...read(KEY(account)), key])].slice(-24);
    localStorage.setItem(KEY(account), JSON.stringify(list));
  } catch {
    // Private mode: the card may show again.
  }
}
