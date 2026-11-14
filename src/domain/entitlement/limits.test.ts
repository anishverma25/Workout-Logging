import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRIAL_DAYS } from './entitlement';
import { FREE_GROUPS, FREE_PROGRESS_DAYS, FREE_ROUTINES, PRO_GROUPS } from './limits';

/**
 * Batch 20 (O9): limits people read about come from the constants that enforce them. A bare
 * number written next to "routines", "groups", "days of Pro" or "free for N days" in app code
 * is copy that will drift the next time a limit changes.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const STRAY = [
  /\b\d+ routines\b/,
  /(^|[\s(`'"])\d+ groups?\b(?![-:])/,
  /\b\d+ days of Pro\b/,
  /\bfree for \d+ days\b/i,
  /\b\d+-day (free )?trial\b/i,
  /\bFree shows (your |the )?last \d+ days\b/,
];

describe('limits are written from their constants', () => {
  it('no bare limit numbers in app copy', () => {
    const stray: string[] = [];
    for (const file of files('src')) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '');
        if (STRAY.some((re) => re.test(code))) stray.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(stray).toEqual([]);
  });

  it('the public home page states the same limits', () => {
    const html = readFileSync('index.html', 'utf8').replace(/<[^>]+>/g, ' ');
    for (const m of html.matchAll(/(\d+) routines\b/g)) expect(Number(m[1])).toBe(FREE_ROUTINES);
    for (const m of html.matchAll(/Progress for the last (\d+) days/g))
      expect(Number(m[1])).toBe(FREE_PROGRESS_DAYS);
    for (const m of html.matchAll(/(\d+) days of Pro/g)) expect(Number(m[1])).toBe(TRIAL_DAYS);
    for (const m of html.matchAll(/up to (\d+) groups/gi)) expect(Number(m[1])).toBe(PRO_GROUPS);
    expect(FREE_GROUPS).toBe(1);
  });
});
