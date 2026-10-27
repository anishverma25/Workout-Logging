import { expect, test, type Page } from '@playwright/test';
import { expireTrial, signUpFresh, startWithDemo } from './session';

/**
 * OverloadGPT (the AI coach), against the real server handler with stand-in AI providers (tests never call a
 * real AI). Pro only; asked once before anything is sent; answers come from the brief; Gemini
 * failing falls back to Groq; the chat stays on the phone and can be cleared.
 */

async function turnOn(page: Page) {
  await expect(page.locator('[data-coach-consent]')).toBeVisible();
  await page.getByRole('button', { name: 'Turn on' }).click();
}

test('free accounts see the coach everywhere, marked Pro, and locked', async ({ page }) => {
  const email = await signUpFresh(page, { at: '/progress', tag: 'coach-free' });
  await expireTrial(email);
  await page.goto('/coach');
  await expect(page.locator('[data-pro-lock="ai_coach"]')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your question' })).toHaveCount(0);

  await page.goto('/progress');
  await expect(page.getByRole('link', { name: /Ask OverloadGPT/ })).toContainText('Pro');
  await page.goto('/pro');
  await expect(
    page.locator('#main').getByText('OverloadGPT', { exact: true }).first(),
  ).toBeVisible();
});

test('Explain asks once, then answers from the numbers on the card', async ({ page }) => {
  await startWithDemo(page, { tag: 'coach-explain' });
  await page.goto('/progress');
  const explain = page.locator('[data-coach-explain="consistency"]');
  await explain.scrollIntoViewIfNeeded();
  await expect(explain).not.toContainText('Pro');
  await explain.click();
  await turnOn(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Here is what your numbers say')).toBeVisible();
  await expect(dialog.getByText(/Written by AI from your logged numbers/)).toBeVisible();
  await page.keyboard.press('Escape');

  // Turned on once: the next card answers straight away.
  await page.locator('[data-coach-explain="volume"]').click();
  await expect(page.locator('[data-coach-consent]')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText('Here is what your numbers say')).toBeVisible();
});

test('the chat answers, falls back when Gemini is down, and is kept on the phone', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'coach-chat' });
  await page.goto('/coach');
  await turnOn(page);
  const box = page.getByRole('textbox', { name: 'Your question' });

  await box.fill('bench kyu nahi badh raha?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('You asked: bench kyu nahi badh raha?')).toBeVisible();
  await expect(page.getByText('Here is what your numbers say (main).')).toBeVisible();

  await box.fill('How much rest? #gemini-down');
  await box.press('Enter');
  await expect(page.getByText('Here is what your numbers say (backup).')).toBeVisible();

  // A suggested question: they change from visit to visit and after each answer, and never
  // repeat one already asked.
  const suggested = page.getByRole('group', { name: 'Suggested questions' }).getByRole('button');
  const first = (await suggested.first().textContent())!.trim();
  await suggested.first().click();
  await expect(page.getByText(`You asked: ${first}`)).toBeVisible();
  await expect(suggested.filter({ hasText: first })).toHaveCount(0);

  // Kept on this phone across a reload.
  await page.reload();
  await expect(page.getByText('You asked: bench kyu nahi badh raha?')).toBeVisible();

  // Cleared from Settings.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.goto('/coach');
  await expect(page.getByText('You asked: bench kyu nahi badh raha?')).toHaveCount(0);
});

test('when the AI is down or makes up numbers, the coach says so and can retry', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'coach-errors' });
  await page.goto('/coach');
  await turnOn(page);
  const box = page.getByRole('textbox', { name: 'Your question' });

  await box.fill('Help #all-down');
  await box.press('Enter');
  await expect(
    page.getByText('OverloadGPT is busy right now. Try again in a minute.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await box.fill('My squat? #invent');
  await box.press('Enter');
  await expect(
    page.getByText(/could not give an answer it could back with your numbers/),
  ).toBeVisible();
  await expect(page.getByText('999 kg')).toHaveCount(0);
});

test('the round coach button opens the coach from any screen', async ({ page }) => {
  await startWithDemo(page, { tag: 'coach-launcher' });
  for (const path of ['/', '/history', '/body']) {
    await page.goto(path);
    await expect(page.locator('[data-coach-launcher]')).toBeVisible();
  }
  await page.goto('/coach');
  await expect(page.locator('[data-coach-launcher]')).toHaveCount(0);

  await page.goto('/');
  await page.locator('[data-coach-launcher]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Turn on' }).click();
  await dialog.getByRole('textbox', { name: 'Your question' }).fill('Kal kya karu?');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect(dialog.getByText('You asked: Kal kya karu?')).toBeVisible();
  // The consent never names the AI service behind the coach.
  expect(await page.locator('body').innerText()).not.toMatch(/Gemini|Groq/);
});
