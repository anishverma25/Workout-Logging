import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, signUpFresh, startWithDemo, uniqueEmail } from './session';

/**
 * Round 4: left and right reps, weight and water on Home, sharing routines and saving a workout
 * as one, counts on AI foods, the Exercises New button and box squat, sign up with a taken
 * email, the compact AI row in Add food, long food names, voice typing, one tap with the
 * keyboard open, OverloadGPT at the latest message, and the muscle map.
 */

const IPHONE_16 = { width: 393, height: 852 };

async function noSideScroll(page: Page) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(1);
}

async function userId(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (/^sb-.+-auth-token$/.test(k))
        return (JSON.parse(localStorage.getItem(k)!) as { user: { id: string } }).user.id;
    }
    throw new Error('not signed in');
  });
}

test('one-arm exercise: left and right reps, volume both sides, shown in history', async ({
  page,
}) => {
  await page.setViewportSize(IPHONE_16);
  await signUpFresh(page, { at: '/workout', tag: 'each-side' });
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('one-arm cable triceps');
  await page.getByRole('button', { name: /^One-arm cable triceps extension/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();

  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await expect(card.locator('[data-by-side]')).toBeVisible();
  const row = card.locator('[data-side-reps]').first();
  await card.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('25');
  await row.getByRole('textbox', { name: /left side/ }).fill('6');
  await row.getByRole('textbox', { name: /right side/ }).fill('7');
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  await expect(card.getByRole('button', { name: /^Set 1 done/ })).toBeVisible();
  await noSideScroll(page);

  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish and save' }).click();
  await expect(page).toHaveURL(/summary/);
  // The muscle map: the triceps carried the workout.
  const map = page.locator('[data-muscle-map]');
  await expect(map).toBeVisible();
  await expect(map.locator('[data-area="triceps"][data-level="3"]').first()).toBeAttached();
  await expect(map.locator('[data-muscle-list]')).toContainText('Triceps');

  await page.goto('/history');
  await page.locator('a[href^="/history/"]').first().click();
  await expect(page.getByRole('button', { name: /25 × L 6 · R 7/ })).toContainText('6 / 7');
  await expect(page.locator('[data-muscle-map]')).toBeVisible();
});

test('the switch turns left and right on for any exercise counted in reps', async ({ page }) => {
  await startWithDemo(page, { tag: 'side-switch' });
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await expect(card.locator('[data-side-reps]')).toHaveCount(0);
  await card.getByRole('button', { name: /^Options for/ }).click();
  await page.getByRole('menuitem', { name: 'Log left and right' }).click();
  await expect(card.locator('[data-side-reps]').first()).toBeVisible();
  await card.getByRole('button', { name: /^Options for/ }).click();
  await page.getByRole('menuitem', { name: 'Log both sides together' }).click();
  await expect(card.locator('[data-side-reps]')).toHaveCount(0);
});

test('Home: weight and water in a tap, without leaving Home', async ({ page }) => {
  await page.setViewportSize(IPHONE_16);
  await startWithDemo(page, { tag: 'home-daily' });
  const row = page.locator('[data-daily-row]');
  await expect(row).toBeVisible();
  await row.locator('[data-home-weight]').click();
  const sheet = page.getByRole('dialog');
  const field = sheet.getByLabel(/Weight in kg/);
  // Opens with the last weight, ready to change.
  await expect(field).not.toHaveValue('');
  await field.fill('72.4');
  await sheet.locator('[data-save-weight]').click();
  await expect(page.getByText('Weight saved')).toBeVisible();
  await expect(row.locator('[data-home-weight]')).toContainText('72.4');
  // A second weigh-in today corrects the first.
  await row.locator('[data-home-weight]').click();
  await page
    .getByRole('dialog')
    .getByLabel(/Weight in kg/)
    .fill('72.1');
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();
  await expect(row.locator('[data-home-weight]')).toContainText('72.1');

  const water = row.locator('[data-home-water]');
  const before = Number(/(\d+(?:\.\d+)?)/.exec((await water.textContent())!)![1]);
  await water.locator('[data-home-add-water]').click();
  await expect(page.getByText('Added a glass of water')).toBeVisible();
  await expect(water).toContainText(String(before + 1));
  await noSideScroll(page);
  // The weight graph is still on Home.
  await expect(page.getByRole('region', { name: 'Body weight' })).toBeVisible();
});

test('share a routine as a link; someone without an account adds it after signing up', async ({
  page,
  browser,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signUpFresh(page, { at: '/routines', tag: 'share-from' });
  await page.goto('/routines');
  await page
    .getByRole('button', { name: /^(New routine|Create a routine)$/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('button', { name: /^Upper Lower 4 days a week/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Upper Lower/ })).toBeVisible();
  await page.evaluate(() => {
    // The share sheet is not part of desktop Chromium; the link is copied instead.
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  await page.getByRole('button', { name: 'Routine options' }).click();
  await page.getByRole('menuitem', { name: 'Share routine' }).click();
  await expect(page.getByText(/Link copied/)).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/r#[A-Za-z0-9_-]+$/);

  const friend = await browser.newContext();
  const other = await friend.newPage();
  await other.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(other.getByText('A routine sent to you')).toBeVisible();
  await other.getByRole('button', { name: 'Create a free account to add it' }).click();
  await other.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail('share-to'));
  await other.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await other.getByRole('button', { name: 'Create account' }).click();
  await expect(other).toHaveURL(/\/r$/);
  await other.locator('[data-add-shared-routine]').click();
  await expect(other).toHaveURL(/\/routines\/[0-9a-f-]+$/);
  await expect(other.getByRole('heading', { level: 1, name: /Upper Lower/ })).toBeVisible();
  await friend.close();
});

test('a damaged link says so instead of adding half a routine', async ({ page }) => {
  await signUpFresh(page, { tag: 'share-bad' });
  await page.goto('/r#notaroutine');
  await expect(page.locator('[data-shared-routine-bad]')).toBeVisible();
});

test('a workout in history is saved as a routine', async ({ page }) => {
  await startWithDemo(page, { tag: 'save-routine' });
  await page.goto('/history');
  await page.locator('a[href^="/history/"]').first().click();
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('menuitem', { name: 'Save as a routine' }).click();
  const sheet = page.locator('[data-save-as-routine]');
  await sheet.getByRole('radio', { name: 'New routine' }).click();
  await sheet.getByLabel('Routine name').fill('My lucky day');
  await sheet.locator('[data-save-routine]').click();
  await expect(page).toHaveURL(/\/routines\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'My lucky day' })).toBeVisible();
});

test('AI snap: one more roti than the photo showed, counts change before logging', async ({
  page,
}) => {
  await signUpFresh(page, { tag: 'ai-count' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Lunch' }).click();
  // The AI options are a slim row at the top, above everything else.
  const hero = sheet.locator('[data-ai-hero]');
  expect((await hero.boundingBox())!.height).toBeLessThan(60);
  await sheet.locator('[data-photo-meal]').click();
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await sheet.locator('[data-photo-input]').setInputFiles({
    name: 'thali.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4UaGBFTEMLQkAUtVaAV8W4QQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await sheet.getByRole('button', { name: 'Work it out' }).click();
  const roti = sheet.locator('[data-ai-result] li').filter({ hasText: 'Roti' }).first();
  await expect(roti.locator('[data-ai-count]')).toContainText('2 rotis');
  const kcal2 = Number(/(\d+)\s*kcal/.exec((await roti.textContent())!)![1]);
  await roti.locator('[data-ai-more]').click();
  await expect(roti.locator('[data-ai-count]')).toContainText('3 rotis');
  const kcal3 = Number(/(\d+)\s*kcal/.exec((await roti.textContent())!)![1]);
  expect(kcal3).toBeGreaterThan(kcal2);
  await sheet.getByRole('button', { name: 'Put on my plate' }).click();
  await expect(sheet.locator('[data-plate]')).toContainText('3 rotis');
});

test('a pack is read from its label or typed; there is no barcode option', async ({ page }) => {
  await signUpFresh(page, { tag: 'no-barcode' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('[data-pack-food]').click();
  await expect(sheet.locator('[data-label-start]')).toBeVisible();
  await expect(sheet.locator('[data-label-manual]')).toBeVisible();
  await expect(sheet.getByText(/barcode/i)).toHaveCount(0);
});

test('long food names are shown whole', async ({ page }) => {
  await page.setViewportSize(IPHONE_16);
  await signUpFresh(page, { at: '/food', tag: 'long-name' });
  const name = 'Paneer butter masala with two butter naans and jeera rice';
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Add your own food or family recipe' }).click();
  const form = page.getByRole('dialog', { name: 'Add your own' });
  await form.getByRole('radio', { name: 'From a label' }).click();
  await form.getByLabel('Name').fill(name);
  await form.getByLabel('One serving', { exact: true }).fill('450');
  await form.getByLabel('Calories').fill('900');
  await form.getByLabel('Protein').fill('30');
  await form.getByRole('button', { name: 'Save' }).click();
  await page.locator('[data-add-food]').click();
  const add = page.getByRole('dialog');
  await add.getByRole('searchbox').fill('paneer butter masala with');
  const row = add.locator('[data-food-results] li').filter({ hasText: 'jeera rice' }).first();
  const title = row.locator('[data-food-row] span').first();
  await expect(title).toHaveText(name);
  // Nothing cut off: the name fits in its box.
  expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await row.locator('[data-food-row]').click();
  await expect(add.getByRole('heading', { name })).toBeVisible();
});

test('voice typing shows words while speaking, adds them, and explains a blocked mic', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // A stand-in for the phone's speech recognition: hears a meal, or is blocked.
    class FakeSpeech {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      start() {
        const blocked = (window as unknown as { __blockMic?: boolean }).__blockMic;
        setTimeout(() => {
          if (blocked) {
            this.onerror?.({ error: 'not-allowed' });
            this.onend?.();
            return;
          }
          const r = (t: string, isFinal: boolean) =>
            Object.assign([{ transcript: t }], { isFinal });
          this.onresult?.({ results: [r('2 aloo parathas', false)] });
          setTimeout(() => {
            this.onresult?.({ results: [r('2 aloo parathas with curd', true)] });
            this.onend?.();
          }, 400);
        }, 200);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    // Chromium has its own; the stand-in replaces both names.
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition'])
      Object.defineProperty(window, name, {
        value: FakeSpeech,
        configurable: true,
        writable: true,
      });
  });
  await signUpFresh(page, { tag: 'voice' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('[data-type-meal]').click();
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await sheet.locator('[data-voice]').click();
  await expect(sheet.locator('[data-voice-live]')).toContainText('2 aloo parathas');
  await expect(sheet.locator('#ai-food')).toHaveValue('2 aloo parathas with curd');
  await page.evaluate(() => {
    (window as unknown as { __blockMic?: boolean }).__blockMic = true;
  });
  await sheet.locator('[data-voice]').click();
  await expect(sheet.locator('[data-voice-error]')).toContainText('mic on your keyboard');
});

test('with the keyboard open, one tap does the job; + keeps the search keyboard', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'one-tap' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  const search = sheet.getByRole('searchbox');
  await search.fill('roti');
  await search.focus();
  await sheet.locator('[data-food-results] li [data-quick-add]').first().click();
  await expect(sheet.locator('[data-plate] li')).toHaveCount(1);
  // Still typing: the search kept the keyboard.
  await expect(search).toBeFocused();
  // A button that finishes something closes the keyboard after doing it.
  await sheet.locator('[data-log-plate]').click();
  await expect(page.locator('[data-meal]').filter({ hasText: /roti/i }).first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
});

test('Exercises: one New button in the header, clear of OverloadGPT; box squat is there', async ({
  page,
}) => {
  await page.setViewportSize(IPHONE_16);
  await signUpFresh(page, { at: '/exercises', tag: 'exercises-new' });
  await page.goto('/exercises');
  const add = page.getByRole('button', { name: 'New exercise' });
  await expect(add).toHaveCount(1);
  const a = (await add.boundingBox())!;
  const b = (await page.locator('[data-coach-launcher]').boundingBox())!;
  const overlap = !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
  expect(overlap).toBe(false);
  await page.getByRole('searchbox').fill('box squat');
  await page
    .getByRole('button', { name: /^Box squat/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toContainText('Set a box or bench behind you');
  await expect(page.getByRole('dialog')).toContainText('Quads');
});

test('signing up with an email that has an account says so and offers sign in', async ({
  page,
  browser,
}) => {
  // As in production: email confirmation is on (the fake does this for +confirm addresses).
  const email = uniqueEmail('taken+confirm');
  await page.goto('/sign-up');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/We sent a link to/)).toBeVisible();

  const again = await (await browser.newContext()).newPage();
  await again.goto('/sign-up');
  await again.getByRole('textbox', { name: 'Email' }).fill(email);
  await again.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await again.getByRole('button', { name: 'Create account' }).click();
  await expect(
    again.getByText('There is already an account with this email. Sign in instead.'),
  ).toBeVisible();
  await expect(again.getByText(/We sent a link to/)).toHaveCount(0);
  await again.getByRole('link', { name: 'Sign in with this email' }).click();
  await expect(again).toHaveURL(/sign-in/);
  await expect(again.getByRole('textbox', { name: 'Email' })).toHaveValue(email);
});

test('OverloadGPT opens at the latest message', async ({ page }) => {
  await page.setViewportSize(IPHONE_16);
  await signUpFresh(page, { at: '/', tag: 'coach-scroll' });
  const id = await userId(page);
  await page.evaluate((uid) => {
    const now = Date.now();
    const messages = Array.from({ length: 24 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 ? 'assistant' : 'user',
      text: i === 23 ? 'The latest answer is here.' : `Message ${i}. `.repeat(12),
      at: now - (24 - i) * 60_000,
    }));
    localStorage.setItem(
      `overload.coach.${uid}`,
      JSON.stringify({ consent: true, messages, explained: {} }),
    );
  }, id);
  await page.goto('/coach');
  const latest = page.getByText('The latest answer is here.');
  await expect(latest).toBeInViewport();
});
