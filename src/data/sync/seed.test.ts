import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR } from '@/test/server';
import { SYSTEM_EXERCISES } from '../library/exercises';
import { exerciseSeedSql, FIRST_LIBRARY_SIZE } from './seed';

const SEED_FILE = join(MIGRATIONS_DIR, '20261005000002_exercise_library.sql');

describe('exercise library seed', () => {
  it('matches the library in the app', () => {
    const expected = exerciseSeedSql();
    if (process.env.UPDATE_SEED === '1') writeFileSync(SEED_FILE, expected);
    // If this fails, the library changed: run `UPDATE_SEED=1 pnpm vitest run seed` and add a
    // new migration that applies the change on existing databases.
    expect(readFileSync(SEED_FILE, 'utf8')).toBe(expected);
  });

  it('seeds exercises added later in the migration that added them', () => {
    // Cardio and the other additions of the personal training release.
    const added = exerciseSeedSql(FIRST_LIBRARY_SIZE, SYSTEM_EXERCISES.length);
    const file = join(MIGRATIONS_DIR, '20261007000004_personal_training.sql');
    if (process.env.UPDATE_SEED === '1') {
      const current = readFileSync(file, 'utf8');
      const marker = '-- Generated from src/data/library/exercises.ts';
      const head = current.includes(marker) ? current.slice(0, current.indexOf(marker)) : current;
      writeFileSync(file, `${head.trimEnd()}\n\n${added}`);
    }
    expect(readFileSync(file, 'utf8')).toContain(added);
  });
});
