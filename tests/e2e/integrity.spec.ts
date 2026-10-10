import { expect, test, type Page } from '@playwright/test';

/**
 * Cross-checks numbers on screen against the raw records in IndexedDB, recomputed here with
 * deliberately independent, plain code (not the app's analytics), on the demo dataset.
 */

interface Raw {
  workouts: {
    id: string;
    name: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    deletedAt: string | null;
    pausedMs: number;
  }[];
  sets: {
    workoutId: string;
    exerciseId: string;
    setType: string;
    weightKg: number | null;
    reps: number | null;
    completedAt: string | null;
    deletedAt: string | null;
  }[];
  exercises: { id: string; name: string; trackingType: string; loadMode: string }[];
  bodyWeights: { measuredAt: string; weightKg: number; deletedAt: string | null }[];
}

async function readRaw(page: Page): Promise<Raw> {
  return page.evaluate(
    () =>
      new Promise<Raw>((resolve, reject) => {
        const open = indexedDB.open('overload');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = ['workouts', 'sets', 'exercises', 'bodyWeights'] as const;
          const tx = db.transaction([...names], 'readonly');
          const out = {} as Record<string, unknown[]>;
          for (const n of names) {
            const req = tx.objectStore(n).getAll();
            req.onsuccess = () => (out[n] = req.result);
          }
          tx.oncomplete = () => resolve(out as unknown as Raw);
        };
      }),
  );
}

const localDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};
const num = (text: string | null) => Number((text ?? '').replace(/[^\d.]/g, ''));

function stats(raw: Raw, workoutIds: Set<string>) {
  const byId = new Map(raw.exercises.map((e) => [e.id, e]));
  const sets = raw.sets.filter(
    (s) => workoutIds.has(s.workoutId) && !s.deletedAt && s.completedAt && s.setType !== 'warmup',
  );
  let volume = 0;
  for (const s of sets) {
    const ex = byId.get(s.exerciseId)!;
    if (ex.trackingType !== 'weight_reps' || s.weightKg === null || s.reps === null) continue;
    volume += s.weightKg * s.reps * (ex.loadMode === 'per_hand' ? 2 : 1);
  }
  return { workingSets: sets.length, volume: Math.round(volume) };
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page.locator('#today-title')).toBeVisible();
});

test('Home: last 7 days match the records', async ({ page }) => {
  const raw = await readRaw(page);
  const from = daysAgo(6);
  const recent = raw.workouts.filter(
    (w) => !w.deletedAt && w.status === 'completed' && localDay(w.startedAt) >= from,
  );
  const expected = stats(raw, new Set(recent.map((w) => w.id)));

  // The day strip card; its "Last 7 days" block holds the rolling numbers.
  const week = page.getByRole('region', { name: 'Training days' });
  const value = (label: string) =>
    week.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');
  await expect(value('Sessions')).toHaveText(String(recent.length));
  await expect(value('Working sets')).toHaveText(String(expected.workingSets));
  expect(num(await value('Volume load').textContent())).toBe(expected.volume);
});

test('History: every workout card matches its sets', async ({ page }) => {
  const raw = await readRaw(page);
  await page.goto('/history');
  const cards = page.locator('a[href^="/history/"]');
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  const live = raw.workouts.filter((w) => !w.deletedAt && w.status === 'completed');
  expect(count).toBe(live.length);
  for (let i = 0; i < Math.min(count, 8); i++) {
    const href = (await cards.nth(i).getAttribute('href'))!;
    const id = href.split('/').pop()!;
    const expected = stats(raw, new Set([id]));
    const text = (await cards.nth(i).textContent())!;
    expect(text, href).toContain(`${expected.workingSets} sets`);
    expect(text, href).toContain(`${expected.volume.toLocaleString('en-US')} kg`);
  }
});

test('Records: heaviest loads are the true maximum of completed sets', async ({ page }) => {
  const raw = await readRaw(page);
  const byName = new Map(raw.exercises.map((e) => [e.name, e]));
  const liveWorkouts = new Set(
    raw.workouts.filter((w) => !w.deletedAt && w.status === 'completed').map((w) => w.id),
  );
  for (const name of ['Overhead press', 'Back squat', 'Barbell row']) {
    const ex = byName.get(name)!;
    const max = Math.max(
      ...raw.sets
        .filter(
          (s) =>
            s.exerciseId === ex.id &&
            liveWorkouts.has(s.workoutId) &&
            s.completedAt &&
            !s.deletedAt &&
            s.setType !== 'warmup',
        )
        .map((s) => s.weightKg ?? 0),
    );
    await page.goto('/records');
    await page
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .first()
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText(`${max} kg`).first()).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('Body weight: latest entry and 7-day average match the records', async ({ page }) => {
  const raw = await readRaw(page);
  const entries = raw.bodyWeights
    .filter((b) => !b.deletedAt)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const latest = entries.at(-1)!;
  const end = new Date(latest.measuredAt).getTime();
  const window = entries.filter((e) => end - new Date(e.measuredAt).getTime() < 7 * 86_400_000);
  const avg = window.reduce((s, e) => s + e.weightKg, 0) / window.length;

  const card = page.getByRole('region', { name: 'Body weight' });
  await expect(card).toContainText(`${Math.round(latest.weightKg * 10) / 10}`);
  await expect(card).toContainText(
    `7-day average ${Math.round(avg * 10) / 10} kg from ${window.length} entries`,
  );
});
