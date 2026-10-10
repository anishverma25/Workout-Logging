import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page.locator('#today-title')).toBeVisible();
});

/**
 * Starts the demo's Push day, whose first exercise is a weighted lift. Not "today's" day:
 * that changes with the calendar (a Pull day starts with pull-ups, which have no load field).
 */
async function startRoutineWorkout(page: Page) {
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
}

const firstCard = (page: Page) => page.locator('section[aria-labelledby^="ex-"]').first();

test('logging a set from a routine, with last time visible and rest starting', async ({ page }) => {
  await startRoutineWorkout(page);
  const card = firstCard(page);
  // Last time is shown inline, without leaving the workout.
  await expect(card.getByText(/^Last time/)).toBeVisible();
  await expect(
    card.getByRole('button', { name: /^Last time .* Copy into this set\.$/ }).first(),
  ).toBeVisible();

  await card.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('77.5');
  await card.getByRole('textbox', { name: 'Set 1 reps' }).fill('8');
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  await expect(card.getByRole('button', { name: 'Set 1 done. Tap to undo.' })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible();

  // Undo, then complete again: only one completion, no duplicates.
  await card.getByRole('button', { name: 'Set 1 done. Tap to undo.' }).click();
  await expect(card.getByRole('button', { name: 'Mark set 1 done' })).toBeVisible();
  await card.getByRole('button', { name: 'Mark set 1 done' }).dblclick();
  await expect(card.getByRole('button', { name: 'Set 1 done. Tap to undo.' })).toBeVisible();
  await expect(page.getByText(/1 of \d+ sets/)).toBeVisible();
});

test('an empty set is completed with last time’s numbers in one tap', async ({ page }) => {
  await startRoutineWorkout(page);
  const card = firstCard(page);
  const load = card.getByRole('textbox', { name: 'Set 1 load in kg' });
  await expect(card.getByText(/^Last time/)).toBeVisible();
  const hint = await load.getAttribute('placeholder');
  expect(hint).toBeTruthy();
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  await expect(load).toHaveValue(hint!);
});

test('the workout survives a refresh, including text typed a moment ago and the rest timer', async ({
  page,
}) => {
  await startRoutineWorkout(page);
  const card = firstCard(page);
  await card.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('81');
  await card.getByRole('textbox', { name: 'Set 1 reps' }).fill('6');
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  await card.getByRole('textbox', { name: 'Set 2 load in kg' }).fill('82.5');
  await page.waitForTimeout(600); // the field saves shortly after typing stops, no blur needed
  await page.reload();

  const after = firstCard(page);
  await expect(after.getByRole('button', { name: 'Set 1 done. Tap to undo.' })).toBeVisible();
  await expect(after.getByRole('textbox', { name: 'Set 1 load in kg' })).toHaveValue('81');
  await expect(after.getByRole('textbox', { name: 'Set 2 load in kg' })).toHaveValue('82.5');
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible();
});

test('leaving the workout shows a way back, and starting another asks first', async ({ page }) => {
  await startRoutineWorkout(page);
  await page.goto('/history');
  await page.getByRole('link', { name: /in progress/ }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();

  await page.goto('/workout');
  await page.goto('/');
  await page.getByRole('link', { name: /in progress/ }).waitFor();
  await page.goto('/routines');
  await page.getByRole('link', { name: 'Push Pull Legs' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await expect(
    page.getByRole('heading', { name: 'A workout is already in progress' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Resume it' }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
});

test('pause, finish, summary, then history', async ({ page }) => {
  await startRoutineWorkout(page);
  await page.getByRole('button', { name: 'Pause workout' }).click();
  await expect(page.getByText(/^Paused\./)).toBeVisible();
  await page.getByRole('button', { name: 'Resume workout' }).click();

  const card = firstCard(page);
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  await card.getByRole('button', { name: 'Mark set 2 done' }).click();
  const name = (await page.locator('header button span').first().textContent())!.trim();

  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish and save' }).click();
  await expect(page.getByRole('heading', { name: `${name} done` })).toBeVisible();
  await expect(page.getByText('Working sets', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Done' }).click();
  await page.goto('/history');
  await expect(page.getByText(name).first()).toBeVisible();
  // No workout is left running.
  await page.goto('/workout');
  await expect(page.getByRole('heading', { name: 'Empty workout' })).toBeVisible();
});

test('a session done today shows Completed, with View and Repeat (B1)', async ({ page }) => {
  await page.goto('/workout');
  await expect(page.getByRole('heading', { name: 'Empty workout' })).toBeVisible();
  const todayCard = page.locator('article', { has: page.getByText('Today', { exact: true }) });
  test.skip((await todayCard.count()) === 0, 'Today is a rest day in the demo routine.');
  const dayName = (await todayCard.getByRole('heading', { level: 3 }).textContent())!.trim();
  await todayCard.getByRole('button', { name: `Start ${dayName}` }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  await firstCard(page).getByRole('button', { name: 'Mark set 1 done' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish and save' }).click();
  await expect(page.getByRole('heading', { name: `${dayName} done` })).toBeVisible();

  await page.goto('/workout');
  const done = page.locator('article', { has: page.getByText('Completed', { exact: true }) });
  await expect(done.getByRole('heading', { name: dayName })).toBeVisible();
  await expect(done.getByRole('link', { name: 'View' })).toHaveAttribute('href', /^\/history\//);
  await expect(page.getByRole('button', { name: `Start ${dayName}` })).toHaveCount(0);
  await done.getByRole('button', { name: `Repeat ${dayName}` }).click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
});

test('empty workout: add an exercise, log it, finish', async ({ page }) => {
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('pec deck');
  await page.getByRole('button', { name: /^Pec deck/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();

  const card = firstCard(page);
  await expect(card.getByText('First time logging this exercise')).toBeVisible();
  await card.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('45');
  await card.getByRole('textbox', { name: 'Set 1 reps' }).fill('12');
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  // Set 2 suggests the set above it when there is no history.
  await expect(card.getByRole('textbox', { name: 'Set 2 load in kg' })).toHaveAttribute(
    'placeholder',
    '45',
  );

  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish and save' }).click();
  await expect(page.getByText('First time')).toBeVisible();
});

test('discarding a workout removes it', async ({ page }) => {
  await startRoutineWorkout(page);
  await firstCard(page).getByRole('button', { name: 'Mark set 1 done' }).click();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('button', { name: 'Discard workout' }).last().click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/workout');
  await expect(page.getByRole('heading', { name: 'Empty workout' })).toBeVisible();
});

test('editing a routine target shows up in the next workout', async ({ page }) => {
  await page.goto('/routines');
  await page.getByRole('link', { name: 'Push Pull Legs' }).click();
  await page
    .getByRole('button', { name: /Barbell bench press/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Increase highest reps' }).click();
  await page.getByRole('button', { name: 'Increase sets' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('4 × 5 to 9').first()).toBeVisible();

  const push = page.locator('section', { has: page.getByRole('heading', { name: 'Push' }) });
  await push.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(firstCard(page).getByText(/Target 4 × 5 to 9/)).toBeVisible();
});

test('lb input is shown back exactly as typed', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'lb' }).click();
  // Wait for the save to commit before a full page load.
  await expect(page.getByText('Showing weights in lb')).toBeVisible();
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('back squat');
  await page.getByRole('button', { name: /^Back squat/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  const load = firstCard(page).getByRole('textbox', { name: 'Set 1 load in lb' });
  await load.fill('225');
  await load.blur();
  // Wait for the save to reach the device database, as a person would, before reloading.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        for (const { name } of await indexedDB.databases()) {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(name!);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (!db.objectStoreNames.contains('sets')) {
            db.close();
            continue;
          }
          const rows = await new Promise<{ weightKg: number | null }[]>((resolve) => {
            const req = db.transaction('sets').objectStore('sets').getAll();
            req.onsuccess = () => resolve(req.result);
          });
          db.close();
          // 225 lb is 102.06 kg.
          if (rows.some((r) => r.weightKg !== null && Math.abs(r.weightKg - 102.058) < 0.01))
            return true;
        }
        return false;
      }),
    )
    .toBe(true);
  await page.reload();
  await expect(firstCard(page).getByRole('textbox', { name: 'Set 1 load in lb' })).toHaveValue(
    '225',
  );
});
