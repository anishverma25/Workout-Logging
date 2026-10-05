import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR } from '@/test/server';
import { exerciseSeedSql } from './seed';

const SEED_FILE = join(MIGRATIONS_DIR, '20261005000002_exercise_library.sql');

describe('exercise library seed', () => {
  it('matches the library in the app', () => {
    const expected = exerciseSeedSql();
    if (process.env.UPDATE_SEED === '1') writeFileSync(SEED_FILE, expected);
    // If this fails, the library changed: run `UPDATE_SEED=1 pnpm vitest run seed` and add a
    // new migration that applies the change on existing databases.
    expect(readFileSync(SEED_FILE, 'utf8')).toBe(expected);
  });
});
