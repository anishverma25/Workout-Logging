import { describe, expect, it } from 'vitest';
import { OFF_STATE, type SyncState } from '@/data/sync/controller';
import {
  LEGACY_HOSTS,
  legacyRedirect,
  movePlan,
  moveTarget,
  photoFileName,
  readyToMove,
} from './domain';

const NEW = 'https://macrotrophy.in';
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
      'https://macrotrophy.in/progress?a=1#x',
    );
  });
  it('stays put when the move is not switched on', () => {
    expect(moveTarget(at(LEGACY_HOSTS[0]!), undefined)).toBeNull();
    expect(moveTarget(at(LEGACY_HOSTS[0]!), '')).toBeNull();
  });
  it('never moves previews, localhost or the new domain itself', () => {
    expect(moveTarget(at('abc123.overload-gym.pages.dev'), NEW)).toBeNull();
    expect(moveTarget(at('localhost'), NEW)).toBeNull();
    expect(moveTarget(at('macrotrophy.in'), NEW)).toBeNull();
  });
  it('ignores a target that is not https or not a URL', () => {
    expect(moveTarget(at(LEGACY_HOSTS[0]!), 'http://macrotrophy.in')).toBeNull();
    expect(moveTarget(at(LEGACY_HOSTS[0]!), 'macrotrophy.in')).toBeNull();
  });
});

describe('the Macrotrophy rename', () => {
  it('moves overloadgym.in (and www) to macrotrophy.in, keeping the path', () => {
    expect(moveTarget(at('overloadgym.in', '/food', '?m=lunch'), NEW)).toBe(
      'https://macrotrophy.in/food?m=lunch',
    );
    expect(moveTarget(at('www.overloadgym.in', '/'), NEW)).toBe('https://macrotrophy.in/');
  });
  it('redirects page requests on overloadgym.in once switched on, and nothing else', () => {
    const res = legacyRedirect('GET', 'https://overloadgym.in/terms', NEW);
    expect(res?.status).toBe(301);
    expect(res?.headers.get('Location')).toBe('https://macrotrophy.in/terms');
    expect(legacyRedirect('GET', 'https://overloadgym.in/terms', undefined)).toBeNull();
    expect(legacyRedirect('POST', 'https://overloadgym.in/terms', NEW)).toBeNull();
    expect(legacyRedirect('GET', 'https://macrotrophy.in/terms', NEW)).toBeNull();
  });
});

describe('movePlan', () => {
  const base = {
    target: 'https://macrotrophy.in/',
    installed: false,
    photos: 0,
    photosDone: false,
    ready: true,
  };
  it('stays when there is nowhere to move', () => {
    expect(movePlan({ ...base, target: null })).toBe('stay');
  });
  it('never moves an installed app: it shows how to install the new one', () => {
    expect(movePlan({ ...base, installed: true })).toBe('install');
    expect(movePlan({ ...base, installed: true, photos: 3, ready: false })).toBe('install');
  });
  it('offers to save phone-only photos before a tab moves', () => {
    expect(movePlan({ ...base, photos: 2 })).toBe('save-photos');
    expect(movePlan({ ...base, photos: 2, photosDone: true })).toBe('move');
    expect(movePlan({ ...base, photos: null })).toBe('wait');
  });
  it('waits for every change to be saved', () => {
    expect(movePlan({ ...base, ready: false })).toBe('wait');
    expect(movePlan({ ...base, photos: 2, photosDone: true, ready: false })).toBe('wait');
  });
  it('names saved photos by date and pose', () => {
    expect(photoFileName('2026-10-03T08:00:00.000Z', 'front', 0)).toBe(
      'macrotrophy-2026-10-03-front-1.jpg',
    );
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
    expect(res?.headers.get('Location')).toBe('https://macrotrophy.in/history?x=1');
  });
  it('does nothing until the move is switched on', () => {
    expect(legacyRedirect('GET', `${OLD}/`, undefined)).toBeNull();
  });
  it('leaves the new domain, previews and other methods alone', () => {
    expect(legacyRedirect('GET', 'https://macrotrophy.in/', NEW)).toBeNull();
    expect(legacyRedirect('GET', 'https://abc123.overload-gym.pages.dev/', NEW)).toBeNull();
    expect(legacyRedirect('POST', `${OLD}/`, NEW)).toBeNull();
  });
});
