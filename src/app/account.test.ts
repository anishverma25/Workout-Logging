import { describe, expect, it } from 'vitest';
import { cleanCode, isBrandNew, isIosHomeScreenApp, storedUser } from './account';

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

describe('email codes and Google', () => {
  it('keeps only the digits of a pasted code', () => {
    expect(cleanCode('Code: 123 456')).toBe('123456');
    expect(cleanCode('12-34-56-78-90-12')).toBe('1234567890');
  });

  it('treats an account made in the last minutes as a new sign-up', () => {
    const now = Date.parse('2026-11-19T10:00:00Z');
    expect(isBrandNew('2026-11-19T09:58:00Z', now)).toBe(true);
    expect(isBrandNew('2026-11-19T09:40:00Z', now)).toBe(false);
    expect(isBrandNew(null, now)).toBe(false);
  });

  it('knows an iPhone home-screen app, where Google sign-in is not offered', () => {
    expect(isIosHomeScreenApp({ standalone: true } as unknown as Navigator)).toBe(true);
    expect(isIosHomeScreenApp({} as Navigator)).toBe(false);
    expect(isIosHomeScreenApp(undefined)).toBe(false);
  });
});
