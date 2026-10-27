import { describe, expect, it } from 'vitest';
import { storedUser } from './account';

function storage(items: Record<string, string>) {
  const keys = Object.keys(items);
  return {
    length: keys.length,
    key: (i: number) => keys[i] ?? null,
    getItem: (k: string) => items[k] ?? null,
  };
}

describe('storedUser', () => {
  it('reads the saved session without waiting for the network', () => {
    const s = storage({
      'overload.seenTour': '1',
      'sb-abc-auth-token': JSON.stringify({ user: { id: 'u1', email: 'a@b.in' } }),
    });
    expect(storedUser(s)).toEqual({ id: 'u1', email: 'a@b.in' });
  });

  it('finds nothing when no one is signed in or the entry is broken', () => {
    expect(storedUser(storage({}))).toBeNull();
    expect(storedUser(storage({ 'sb-abc-auth-token': '{not json' }))).toBeNull();
    expect(storedUser(storage({ 'sb-abc-auth-token': '{}' }))).toBeNull();
  });
});
