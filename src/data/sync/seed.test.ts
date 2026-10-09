import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestServer, MIGRATIONS_DIR } from '@/test/server';
import { SYSTEM_EXERCISES, SYSTEM_EXERCISE_KEYS } from '../library/exercises';
import { exerciseSeedSql, LIBRARY_ADDITIONS_SIZE } from './seed';

/**
 * Applied migrations never change, so later library changes go in later migrations. What
 * matters is the end state: after every migration runs, the server's exercise table must match
 * the library in the app exactly (ids, names, muscles, everything).
 */

const LATEST = join(MIGRATIONS_DIR, '20261010000007_training_details.sql');
const MARKER = '-- Generated from src/data/library/exercises.ts';

describe('exercise library seed', () => {
  it('the latest migration seeds the rows changed or added since the last release', () => {
    const changed = exerciseSeedSql(LIBRARY_ADDITIONS_SIZE - 1, SYSTEM_EXERCISES.length);
    if (process.env.UPDATE_SEED === '1') {
      const current = readFileSync(LATEST, 'utf8');
      const head = current.includes(MARKER) ? current.slice(0, current.indexOf(MARKER)) : current;
      writeFileSync(LATEST, `${head.trimEnd()}\n\n${changed}`);
    }
    // If this fails, run `UPDATE_SEED=1 pnpm vitest run seed`.
    expect(readFileSync(LATEST, 'utf8')).toContain(changed);
  });

  it('after every migration, the server library matches the app library', async () => {
    const server = await createTestServer();
    try {
      const { rows } = await server.pg.query<{
        id: string;
        key: string;
        name: string;
        primary_muscle: string;
        secondary_muscles: string[];
        equipment: string;
        category: string;
        tracking_type: string;
        load_mode: string;
        instructions: string;
      }>('select * from public.exercises order by key');
      const server_ = new Map(rows.map((r) => [r.id, r]));
      expect(rows).toHaveLength(SYSTEM_EXERCISES.length);
      SYSTEM_EXERCISES.forEach((e, i) => {
        const r = server_.get(e.id);
        expect(r, e.name).toBeDefined();
        expect({
          key: r!.key,
          name: r!.name,
          primary: r!.primary_muscle,
          secondary: r!.secondary_muscles,
          equipment: r!.equipment,
          category: r!.category,
          tracking: r!.tracking_type,
          loadMode: r!.load_mode,
          instructions: r!.instructions,
        }).toEqual({
          key: SYSTEM_EXERCISE_KEYS[i],
          name: e.name,
          primary: e.primaryMuscle,
          secondary: e.secondaryMuscles,
          equipment: e.equipment,
          category: e.category,
          tracking: e.trackingType,
          loadMode: e.loadMode,
          instructions: e.instructions,
        });
      });
    } finally {
      await server.close();
    }
  }, 60_000);
});
