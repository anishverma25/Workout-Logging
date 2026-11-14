import {
  buildReport,
  fingerprintOf,
  isNoise,
  refusalCode,
  scrubRoute,
  scrubStack,
  scrubText,
} from './errorReport';

describe('error reports carry nothing personal', () => {
  it('drops query strings and hashes from addresses', () => {
    expect(scrubText('failed https://macrotrophy.in/food?q=paneer#x at x')).toBe(
      'failed https://macrotrophy.in/food at x',
    );
    expect(scrubRoute('/r#eJx-shared-routine-code')).toBe('/r');
    expect(scrubRoute('/food?date=2026-11-14')).toBe('/food');
  });
  it('folds ids so the same screen groups together', () => {
    expect(scrubRoute('/workouts/2b1f6a1e-6c1c-4a39-9f0b-0a8c1d3e5f77/summary')).toBe(
      '/workouts/:id/summary',
    );
    expect(scrubRoute('/groups/12345')).toBe('/groups/:id');
  });
  it('drops anything after "brief"', () => {
    expect(scrubText('Bad brief: Person: age 24, body weight 80 kg, notes: knee')).toBe(
      'Bad brief',
    );
  });
  it('removes emails, tokens and quoted text', () => {
    const t = scrubText(
      'Could not log "Paneer butter masala" for asha@example.com with eyJhbGciOi.eyJzdWIi.sig',
    );
    expect(t).not.toMatch(/Paneer|asha|eyJ/);
    // Quoted code names stay: they say what broke.
    expect(scrubText("Cannot read properties of undefined (reading 'map')")).toContain("'map'");
  });
  it('keeps only stack frames, scrubbed', () => {
    const stack =
      'Error: x\n    at f (https://macrotrophy.in/assets/a.js?v=2:1:2)\nrandom note line';
    expect(scrubStack(stack)).toBe('at f (https://macrotrophy.in/assets/a.js:1:2)');
  });
  it('the same failure gets the same fingerprint whatever the numbers', () => {
    expect(fingerprintOf('crash', 'Index 3 out of range', 'at f (a.js:1:2)')).toBe(
      fingerprintOf('crash', 'Index 7 out of range', 'at f (a.js:9:9)'),
    );
  });
  it('builds a report within the server limits', () => {
    const r = buildReport('crash', new Error('x'.repeat(1000)), '/home?x=1', 'abc');
    expect(r.message.length).toBeLessThanOrEqual(300);
    expect(r.route).toBe('/home');
  });
  it('ignores browser noise and network drops', () => {
    expect(isNoise('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(isNoise('TypeError: Failed to fetch')).toBe(true);
    expect(isNoise('TypeError: Failed to fetch dynamically imported module')).toBe(false);
  });
  it('a refused change reports a constraint or code, never the row', () => {
    expect(
      refusalCode(
        'new row violates check constraint "sets_reps_check" Failing row contains (Asha)',
      ),
    ).toBe('sets_reps_check');
    expect(refusalCode('PGRST204 Could not find column')).toBe('PGRST204');
    expect(refusalCode('Something about paneer')).toBe('refused');
  });
});
