import { isChunkLoadError } from './chunkReload';

describe('isChunkLoadError', () => {
  it('recognises a missing code file after a deploy, in Chrome, Safari and Firefox wording', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
