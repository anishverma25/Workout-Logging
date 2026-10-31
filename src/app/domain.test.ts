import { describe, expect, it } from 'vitest';
import { OFF_STATE, type SyncState } from '@/data/sync/controller';
import { LEGACY_HOSTS, legacyRedirect, moveTarget, readyToMove } from './domain';

const NEW = 'https://overloadgym.in';
const at = (hostname: string, pathname = '/', search = '', hash = '') => ({
  hostname,
  pathname,
  search,
  hash,
});
const idle: SyncState = { ...OFF_STATE, phase: 'idle' };

describe('moveTarget', () => {
  it('moves the old address and keeps path, query and hash', () => {
    expect(moveTarget(at(LEGACY_HOSTS[0]!, '/progress', '?a=1', '#x'), NEW)).toBe(
      'https://overloadgym.in/progress?a=1#x',
    );
  });
  it('stays put when the move is not switched on', () => {
    expect(moveTarget(at(LEGACY_HOSTS[0]!), undefined)).toBeNull();
    expect(moveTarget(at(LEGACY_HOSTS[0]!), '')).toBeNull();
  });
  it('never moves previews, localhost or the new domain itself', () => {
    expect(moveTarget(at('abc123.overload-gym.pages.dev'), NEW)).toBeNull();
    expect(moveTarget(at('localhost'), NEW)).toBeNull();
    expect(moveTarget(at('overloadgym.in'), NEW)).toBeNull();
  });
  it('ignores a target that is not https or not a URL', () => {
    expect(moveTarget(at(LEGACY_HOSTS[0]!), 'http://overloadgym.in')).toBeNull();
    expect(moveTarget(at(LEGACY_HOSTS[0]!), 'overloadgym.in')).toBeNull();
  });
});

describe('readyToMove', () => {
  it('waits while the account is loading', () => {
    expect(readyToMove({ status: 'loading' }, idle)).toBe(false);
  });
  it('is ready with no account open or no cloud', () => {
    expect(readyToMove({ status: 'signedOut' }, OFF_STATE)).toBe(true);
    expect(readyToMove({ status: 'unavailable' }, OFF_STATE)).toBe(true);
  });
  it('is ready for an account only when every change is saved to the server', () => {
    expect(readyToMove({ status: 'signedIn' }, idle)).toBe(true);
    expect(readyToMove({ status: 'signedIn' }, { ...idle, pending: 2 })).toBe(false);
    expect(readyToMove({ status: 'signedIn' }, { ...idle, rejected: 1, pending: 1 })).toBe(false);
    expect(readyToMove({ status: 'signedIn' }, { ...idle, phase: 'syncing' })).toBe(false);
    expect(readyToMove({ status: 'signedIn' }, { ...idle, phase: 'offline' })).toBe(false);
    expect(readyToMove({ status: 'signedIn' }, OFF_STATE)).toBe(false);
  });
});

describe('legacyRedirect', () => {
  const OLD = `https://${LEGACY_HOSTS[0]}`;
  it('sends a page on the old address to the same page on the new one, permanently', () => {
    const res = legacyRedirect('GET', `${OLD}/history?x=1`, NEW);
    expect(res?.status).toBe(301);
    expect(res?.headers.get('Location')).toBe('https://overloadgym.in/history?x=1');
  });
  it('does nothing until the move is switched on', () => {
    expect(legacyRedirect('GET', `${OLD}/`, undefined)).toBeNull();
  });
  it('leaves the new domain, previews and other methods alone', () => {
    expect(legacyRedirect('GET', 'https://overloadgym.in/', NEW)).toBeNull();
    expect(legacyRedirect('GET', 'https://abc123.overload-gym.pages.dev/', NEW)).toBeNull();
    expect(legacyRedirect('POST', `${OLD}/`, NEW)).toBeNull();
  });
});
