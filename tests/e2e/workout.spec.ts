import { expect, test, type Page } from '@playwright/test';
import { startWithDemo } from './session';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await startWithDemo(page);
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

test('fewer sets than the routine plans: remove the open ones, with undo', async ({ page }) => {
  await startRoutineWorkout(page);
  const card = firstCard(page);
  const rows = card.getByRole('button', { name: /^Mark set \d+ done$/ });
  const planned = await rows.count();
  expect(planned).toBeGreaterThanOrEqual(2);

  await card.getByRole('button', { name: 'Remove set' }).click();
  await expect(rows).toHaveCount(planned - 1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(rows).toHaveCount(planned);

  // A done set is never removed this way.
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  for (let i = 1; i < planned; i++) await card.getByRole('button', { name: 'Remove set' }).click();
  // Only the done set is left, so the exercise folds as finished, with nothing more to remove.
  await expect(rows).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Remove set' })).toHaveCount(0);
});

test('logging a set from a routine, with last time visible and rest starting', async ({ page }) => {
  await startRoutineWorkout(page);
  const card = firstCard(page);
  // Last time is shown inline, without leaving the workout.
  await expect(card.getByText(/^Last: /)).toBeVisible();
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
  await expect(card.getByText(/^Last: /)).toBeVisible();
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

test('a finished exercise folds to one row, opens again, and can take another set (B2)', async ({
  page,
}) => {
  await startRoutineWorkout(page);
  const card = firstCard(page);
  const name = (await card.getByRole('heading').first().textContent())!.trim();
  const checks = card.getByRole('button', { name: /^Mark set \d+ done$/ });
  const count = await checks.count();
  for (let i = 0; i < count; i++) {
    await checks.first().click();
    await expect(checks).toHaveCount(count - i - 1);
  }
  const folded = card.getByRole('button', { name: `${name}, all ${count} sets done. Show sets` });
  await expect(folded).toBeVisible();
  await expect(folded).toContainText(`${count} of ${count}`);
  await folded.click();
  await card.getByRole('button', { name: 'Add set' }).click();
  await expect(card.getByRole('button', { name: `Mark set ${count + 1} done` })).toBeVisible();
});

test('finishing with sets left asks first and says how many are done (B3)', async ({ page }) => {
  await startRoutineWorkout(page);
  await firstCard(page).getByRole('button', { name: 'Mark set 1 done' }).click();
  await expect(
    firstCard(page).getByRole('button', { name: 'Set 1 done. Tap to undo.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  const sheet = page.getByRole('dialog', { name: 'Finish anyway?' });
  await expect(sheet).toContainText(/1 of \d+ sets done\./);
  await sheet.getByRole('button', { name: 'Keep going' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
});

test('rest and bench angle use steppers, presets and a keypad (B5)', async ({ page }) => {
  await page.goto('/routines');
  await page.getByRole('link', { name: 'Push Pull Legs' }).click();
  await page
    .getByRole('button', { name: /Incline dumbbell press/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog');
  // Keypad: 230 reads as 2:30.
  await sheet.getByRole('spinbutton', { name: 'Rest after each set' }).click();
  await sheet.getByRole('textbox', { name: 'Rest after each set, type a time' }).fill('230');
  await sheet.getByRole('button', { name: 'Done' }).first().click();
  await expect(sheet.getByRole('spinbutton', { name: 'Rest after each set' })).toHaveAttribute(
    'aria-valuetext',
    '2:30',
  );
  await sheet.getByRole('button', { name: 'Increase Rest after each set' }).click();
  await expect(sheet.getByRole('spinbutton', { name: 'Rest after each set' })).toHaveAttribute(
    'aria-valuetext',
    '2:45',
  );
  await sheet.getByRole('button', { name: '3:00', exact: true }).click();
  await expect(sheet).toContainText('3:00 rest');

  // Bench angle: preset, then a step.
  const add = sheet.getByRole('button', { name: 'Add angle' });
  if (await add.count()) await add.click();
  await sheet.getByRole('button', { name: '45°' }).click();
  await sheet.getByRole('button', { name: 'Increase Incline angle' }).click();
  await expect(sheet.getByRole('spinbutton', { name: 'Incline angle' })).toHaveAttribute(
    'aria-valuetext',
    '50°',
  );
  await sheet.getByRole('button', { name: 'Done', exact: true }).last().click();
  await expect(page.getByText('50° incline').first()).toBeVisible();
});

test('rest bar: 15 seconds more or less, and Skip', async ({ page }) => {
  await startRoutineWorkout(page);
  await firstCard(page).getByRole('button', { name: 'Mark set 1 done' }).click();
  const bar = page.getByRole('timer', { name: 'Rest timer' });
  await expect(bar).toBeVisible();
  const open = bar.getByRole('button', { name: /^Rest \d+:\d{2} left/ });
  const seconds = async () => {
    const m = /Rest (\d+):(\d{2}) left/.exec((await open.getAttribute('aria-label')) ?? '');
    return Number(m![1]) * 60 + Number(m![2]);
  };
  const before = await seconds();
  await bar.getByRole('button', { name: '15 seconds more' }).click();
  await expect.poll(seconds).toBeGreaterThan(before + 10);
  const raised = await seconds();
  await bar.getByRole('button', { name: '15 seconds less' }).click();
  await expect.poll(seconds).toBeLessThan(raised - 10);
  await bar.getByRole('button', { name: 'Skip rest' }).click();
  await expect(bar).toHaveCount(0);
});

test('the Last column says New when there is no history, never a lone dot', async ({ page }) => {
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('pec deck');
  await page.getByRole('button', { name: /^Pec deck/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  const last = firstCard(page).getByRole('button', { name: 'No matching set last time' }).first();
  await expect(last).toHaveText('New');
});

test('keyboard toolbar steps the focused cell and moves to the next one', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The toolbar is for touch screens.');
  await startRoutineWorkout(page);
  const card = firstCard(page);
  const load = card.getByRole('textbox', { name: 'Set 1 load in kg' });
  await load.fill('60');
  const toolbar = page.getByRole('toolbar', { name: 'Number keys' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: '+2.5' }).click();
  await expect(load).toHaveValue('62.5');
  await toolbar.getByRole('button', { name: '−2.5' }).click();
  await toolbar.getByRole('button', { name: '−2.5' }).click();
  await expect(load).toHaveValue('57.5');
  await toolbar.getByRole('button', { name: 'Next' }).click();
  const reps = card.getByRole('textbox', { name: 'Set 1 reps' });
  await expect(reps).toBeFocused();
  await reps.fill('8');
  await toolbar.getByRole('button', { name: '+1' }).click();
  await expect(reps).toHaveValue('9');
});

test('the three-dot menu drops from its button, stays on screen and closes cleanly', async ({
  page,
}) => {
  await startRoutineWorkout(page);
  const card = firstCard(page);
  const button = card.getByRole('button', { name: /^Options for/ });
  await button.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  // Fully inside the screen, next to the button, and not a sheet.
  const box = (await menu.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The first item has focus; Escape closes and gives focus back to the button.
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(button).toBeFocused();
  // Tapping the button again, or outside, closes it.
  await button.click();
  await button.click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await button.click();
  await page.mouse.click(5, view.height / 2);
  await expect(page.getByRole('menu')).toHaveCount(0);
  // An item does its job: notes open in their own sheet.
  await button.click();
  await page.getByRole('menuitem', { name: 'Add notes' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('an exercise of your own, made inside a workout, is logged, saved and still there after a reload', async ({
  page,
}) => {
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('Zercher carry hold');
  await page.getByRole('button', { name: 'Create “Zercher carry hold”' }).click();
  const create = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('radiogroup', { name: 'Primary muscle' }) });
  await create
    .getByRole('radiogroup', { name: 'Primary muscle' })
    .getByRole('radio', { name: 'Abs' })
    .click();
  await create.getByRole('button', { name: 'Create exercise' }).click();

  const card = firstCard(page);
  await expect(card).toContainText('Zercher carry hold');
  await card.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('60');
  await card.getByRole('textbox', { name: 'Set 1 reps' }).fill('8');
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: /Finish and save|Finish anyway/ }).click();

  await page.reload();
  await page.goto('/exercises');
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('zercher carry');
  await page
    .getByRole('button', { name: /^Zercher carry hold/ })
    .first()
    .click();
  await expect(page.getByText('Your exercise', { exact: true })).toBeVisible();
  await page.goto('/history');
  await expect(page.locator('a[href^="/history/"]').first()).toContainText('Zercher carry hold');
});
