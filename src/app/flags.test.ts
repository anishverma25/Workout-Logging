import { afterEach, describe, expect, it } from 'vitest';
import { ALL_ON, parseFlags } from './flags';
import { clearPendingPayment, PENDING_MS, pendingPayment } from './billing';

describe('app switches', () => {
  it('anything not switched off stays on', () => {
    expect(parseFlags({})).toEqual(ALL_ON);
    expect(parseFlags(null)).toEqual(ALL_ON);
    expect(parseFlags({ ai_chat: 'no', payments: 0 })).toEqual(ALL_ON);
  });
  it('false turns a feature off, and the notice is trimmed to one short line', () => {
    const f = parseFlags({ ai_photo: false, payments: false, notice: `  ${'x'.repeat(200)} ` });
    expect(f.ai_photo).toBe(false);
    expect(f.payments).toBe(false);
    expect(f.ai_chat).toBe(true);
    expect(f.notice).toHaveLength(140);
    expect(parseFlags({ notice: '   ' }).notice).toBeNull();
  });
  it('Continue with Google stays off until it is switched on', () => {
    expect(ALL_ON.google_sign_in).toBe(false);
    expect(parseFlags({ google_sign_in: 'yes' }).google_sign_in).toBe(false);
    expect(parseFlags({ google_sign_in: true }).google_sign_in).toBe(true);
  });
});

describe('a payment waiting to be confirmed', () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage ??= {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  afterEach(() => clearPendingPayment());
  it('blocks paying again for 30 minutes, then lets go', () => {
    const at = Date.now();
    localStorage.setItem('overload.payPending', JSON.stringify({ paymentId: 'pay_1', at }));
    expect(pendingPayment(at + 60_000)).toEqual({ paymentId: 'pay_1', at });
    expect(pendingPayment(at + PENDING_MS + 1)).toBeNull();
    localStorage.setItem('overload.payPending', '{bad');
    expect(pendingPayment()).toBeNull();
  });
});
