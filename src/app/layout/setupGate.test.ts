import { describe, expect, it } from 'vitest';
import { needsSetup } from './SetupGate';
import { newerThanRelease, RELEASE_AT } from './whatsNewStore';

const now = Date.parse('2026-11-15T10:00:00Z');
const base = {
  createdAt: '2026-11-15T09:00:00Z',
  now,
  synced: true,
  hasProfile: false as boolean | null,
  asked: false,
};

describe('new accounts go through setup once', () => {
  it('a new account with no profile anywhere is sent to setup', () => {
    expect(needsSetup(base)).toBe(true);
  });
  it('waits for the first sync, and for the profile to load', () => {
    expect(needsSetup({ ...base, synced: false })).toBe(false);
    expect(needsSetup({ ...base, hasProfile: null })).toBe(false);
  });
  it('never sends someone set up, asked before, or with an older account', () => {
    expect(needsSetup({ ...base, hasProfile: true })).toBe(false);
    expect(needsSetup({ ...base, asked: true })).toBe(false);
    expect(needsSetup({ ...base, createdAt: '2026-11-01T09:00:00Z' })).toBe(false);
    expect(needsSetup({ ...base, createdAt: null })).toBe(false);
  });
});

describe('what is new is only for people who used the app before', () => {
  it('an account made after the release is new; one made before is not', () => {
    expect(newerThanRelease(RELEASE_AT)).toBe(true);
    expect(newerThanRelease('2026-11-01T00:00:00Z')).toBe(false);
    expect(newerThanRelease(null)).toBe(false);
  });
});
