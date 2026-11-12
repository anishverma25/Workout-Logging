import { expect, test } from '@playwright/test';
import { startWithDemo } from './session';

/**
 * Voice sets: what is said goes through the same path as the microphone (the browser's speech
 * recognition cannot be driven in a test, so the words are handed over directly).
 */
test('a clear sentence logs the set, "same again" repeats it, an unclear one waits for a tap', async ({ page }) => {
  test.setTimeout(90_000);
  await startWithDemo(page, { tag: 'voice' });
  await page.goto('/workout');
  await page.getByRole('button', { name: /^Start Push/ }).first().click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await expect(card).toBeVisible();
  const say = (text: string) =>
    page.evaluate((t) => (window as unknown as { __overloadVoice: (t: string) => Promise<void> }).__overloadVoice(t), text);
  await page.waitForFunction(() => '__overloadVoice' in window);

  await say('100 kilo 5 reps');
  await expect(page.getByText(/: 100 kg × 5 logged$/)).toBeVisible();
  await expect(card.getByRole('textbox', { name: 'Set 1 load in kg' })).toHaveValue('100');
  await expect(card.getByRole('textbox', { name: 'Set 1 reps' })).toHaveValue('5');
  await expect(page.getByText(/^1 of \d+ sets$/)).toBeVisible();

  await say('same again');
  await expect(page.getByText(/^2 of \d+ sets$/)).toBeVisible();
  await expect(card.getByRole('textbox', { name: 'Set 2 load in kg' })).toHaveValue('100');

  // Two bare numbers could be either way round: filled in, not ticked.
  await say('90 8');
  await expect(page.getByText(/90 kg × 8 filled in\. Tap the tick to confirm\.$/)).toBeVisible();
  await expect(card.getByRole('textbox', { name: 'Set 3 load in kg' })).toHaveValue('90');
  await expect(page.getByText(/^2 of \d+ sets$/)).toBeVisible();

  // Hinglish, and an exercise by name.
  await say('overhead sattar ke che');
  await expect(page.getByText(/^Overhead press: 70 kg × 6 logged$/)).toBeVisible();
  await expect(page.getByText(/^3 of \d+ sets$/)).toBeVisible();

  await say('play some music');
  await expect(page.getByText(/Say it like "80 kilo 8 reps"/)).toBeVisible();
});
