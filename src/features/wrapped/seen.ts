const KEY = 'overload.wrapped.seen';

/** The recaps opened on this phone, so the Home card shows once for each. */
export function wrappedSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markWrappedSeen(key: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...wrappedSeen(), key])].slice(-24)));
  } catch {
    // Private mode: the card may show again.
  }
}
