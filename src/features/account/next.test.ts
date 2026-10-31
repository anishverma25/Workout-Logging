import { safeNext } from './next';

describe('safeNext', () => {
  it('keeps paths inside the app', () => {
    expect(safeNext('/history')).toBe('/history');
    expect(safeNext('/history/abc?x=1')).toBe('/history/abc?x=1');
  });
  it('refuses anything that could leave the app', () => {
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '',
      null,
    ]) {
      expect(safeNext(bad)).toBe('/account');
    }
  });
});
