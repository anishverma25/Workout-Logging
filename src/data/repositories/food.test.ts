import { WorkoutDatabase } from '../db';
import { FOOD_BY_ID, customToFood } from '../library/foods';
import {
  copyFoodLogs,
  deleteFoodLogs,
  FoodError,
  keepPlateFoods,
  logFoods,
  restoreFoodLogs,
  saveCustomFood,
  updateFoodLog,
} from './food';
import { saveFoodSettings, saveProfile } from './profile';
import { foodFromItem } from '@/app/foodAi';

let db: WorkoutDatabase;
let n = 0;
beforeEach(async () => {
  db = new WorkoutDatabase(`food-${++n}`, { syncEnabled: true });
  await db.open();
});
afterEach(async () => {
  await db.delete();
});

const roti = FOOD_BY_ID.get('roti')!;
const dal = FOOD_BY_ID.get('dal-tadka')!;

describe('food logging', () => {
  it('logs a thali with snapshot numbers and queues it for sync', async () => {
    const logs = await logFoods(
      db,
      [
        { food: roti, amount: 2, unit: 'piece', size: null, oilLevel: null },
        { food: dal, amount: 1, unit: 'katori', size: 'medium', oilLevel: 'rich' },
      ],
      { date: '2026-10-21', meal: 'lunch' },
    );
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ foodId: 'roti', unit: 'piece', size: null, oilLevel: null });
    expect(logs[0]!.kcal).toBe(204);
    expect(logs[1]).toMatchObject({ grams: 160, oilLevel: 'rich', size: 'medium' });
    expect(logs[1]!.kcal).toBeGreaterThan(139);
    expect(await db.outbox.count()).toBe(2);
  });

  it('uses the person’s own katori', async () => {
    const [l] = await logFoods(
      db,
      [{ food: dal, amount: 1, unit: 'katori', size: 'medium', oilLevel: null }],
      { date: '2026-10-21', meal: 'dinner', katoriMl: 250 },
    );
    expect(l!.grams).toBe(200);
  });

  it('copies a meal, edits, deletes and restores', async () => {
    const [l] = await logFoods(
      db,
      [{ food: dal, amount: 1, unit: 'katori', size: null, oilLevel: null }],
      { date: '2026-10-20', meal: 'lunch' },
    );
    const [c] = await copyFoodLogs(db, [l!], { date: '2026-10-21', meal: 'dinner' });
    expect(c).toMatchObject({ date: '2026-10-21', meal: 'dinner', kcal: l!.kcal });
    expect(c!.id).not.toBe(l!.id);
    await updateFoodLog(
      db,
      c!.id,
      { food: dal, amount: 2, unit: 'katori', size: null, oilLevel: null },
      'dinner',
    );
    expect((await db.foodLogs.get(c!.id))!.grams).toBe(320);
    await deleteFoodLogs(db, [c!.id]);
    expect((await db.foodLogs.get(c!.id))!.deletedAt).not.toBeNull();
    await restoreFoodLogs(db, [c!.id]);
    expect((await db.foodLogs.get(c!.id))!.deletedAt).toBeNull();
  });

  it('rejects portions that cannot be measured', async () => {
    await expect(
      logFoods(db, [{ food: roti, amount: 1, unit: 'katori', size: null, oilLevel: null }], {
        date: '2026-10-21',
        meal: 'lunch',
      }),
    ).rejects.toBeInstanceOf(FoodError);
  });

  it('saves a family recipe and logs a share of the pot', async () => {
    const pot = await saveCustomFood(db, {
      name: 'Mum’s rajma',
      recipe: {
        ingredients: [
          { id: 'rajma', grams: 200 },
          { id: 'onion', grams: 100 },
          { id: 'oil', grams: 30 },
        ],
        cookedG: 1000,
        servings: 4,
      },
    });
    expect(pot).toMatchObject({ kind: 'recipe', servings: 4, cookedG: 1000, diet: 'veg' });
    const food = customToFood(pot);
    const [l] = await logFoods(
      db,
      [{ food, amount: 1, unit: 'share', size: null, oilLevel: null }],
      { date: '2026-10-21', meal: 'lunch' },
    );
    expect(l!.grams).toBe(250);
    // (200 g rajma 674 kcal + 100 g onion 40 + 30 g oil 265) / 4 ≈ 245 kcal.
    expect(l!.kcal).toBeGreaterThan(240);
    expect(l!.kcal).toBeLessThan(250);
    expect(l!.libraryVersion).toBeNull();
  });

  it('checks label values', async () => {
    await expect(
      saveCustomFood(db, {
        name: 'Bar',
        per100: { kcal: 400, proteinG: 60, carbsG: 50, fatG: 10, fibreG: 0 },
      }),
    ).rejects.toThrow(/more than 100 g/);
  });

  it('saves the diet type and katori size on the profile', async () => {
    await saveProfile(db, {
      displayName: 'A',
      birthDate: null,
      goal: 'strength',
      experience: 'beginner',
    });
    await saveFoodSettings(db, { dietType: 'jain', katoriMl: 180 });
    const p = (await db.profiles.toArray())[0]!;
    expect(p).toMatchObject({ dietType: 'jain', katoriMl: 180 });
  });
});

describe('OverloadGPT foods on the plate', () => {
  it('become the person\'s own foods when logged, with the same numbers', async () => {
    const shake = foodFromItem({
      name: 'Starbucks cold coffee',
      portion: '1 tall',
      grams: 350,
      kcal: 200,
      proteinG: 7,
      carbsG: 32,
      fatG: 5,
      fibreG: 0,
      diet: 'veg',
      basis: 'web',
      ref: 'Starbucks India menu',
    });
    const plate = [
      { food: shake, amount: 1, unit: 'serving' as const, size: null, oilLevel: null },
      { food: roti, amount: 2, unit: 'piece' as const, size: null, oilLevel: null },
    ];
    const kept = await keepPlateFoods(db, plate);
    expect(kept[1]!.food).toBe(roti);
    expect(kept[0]!.food.source).toBe('custom');
    const logs = await logFoods(db, kept, { date: '2026-10-20', meal: 'snacks' });
    expect(logs[0]!.kcal).toBeCloseTo(200, 0);
    expect(logs[0]!.foodId).toBe(kept[0]!.food.id);
    expect(await db.customFoods.count()).toBe(1);
  });
});
