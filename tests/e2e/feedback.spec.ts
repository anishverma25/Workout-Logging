import { expect, test, type Page } from '@playwright/test';

/** Feedback: send it from More, see it listed, read the reply; offline it waits and sends. */

const PASSWORD = 'correct-horse-9';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

async function signUp(page: Page) {
  await page.goto('/sign-up?next=/feedback');
  await page
    .getByRole('textbox', { name: 'Email' })
    .fill(`fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible();
}

test('guests are asked to create an account first', async ({ page }) => {
  await page.goto('/feedback');
  await expect(page.getByRole('link', { name: 'Create a free account' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Rating' })).toHaveCount(0);
});

test('send a rating and a message, then see the reply', async ({ page }) => {
  await signUp(page);
  // Nothing to send yet.
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('alert')).toHaveText('Pick a rating or write a few words.');

  await page.getByRole('radio', { name: /^4 stars/ }).click();
  await expect(page.getByText('Really good')).toBeVisible();
  await page.getByRole('button', { name: 'Idea' }).click();
  await page
    .getByRole('textbox', { name: 'What should we change or keep?' })
    .fill('A plate calculator in the logger would be great.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('heading', { name: /^Thank you/ })).toBeVisible();

  const history = page.getByRole('region', { name: 'Your feedback' });
  await expect(history).toContainText('A plate calculator in the logger');
  await expect(history.getByRole('img', { name: '4 of 5 stars' })).toBeVisible();
  await expect(history).toContainText('Sent');

  // The administrator replies in Supabase; the person sees it.
  await fetch('http://localhost:54329/__test/feedback-reply', {
    method: 'POST',
    body: JSON.stringify({ reply: 'Coming in the next update.' }),
  });
  await page.reload();
  await expect(history).toContainText('Reply from Overload');
  await expect(history).toContainText('Coming in the next update.');
});

test('feedback written offline waits on the phone and is sent when back online', async ({
  page,
  context,
}) => {
  await signUp(page);
  await context.setOffline(true);
  await page.getByRole('radio', { name: /^5 stars/ }).click();
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByText(/saved on this phone/)).toBeVisible();
  const history = page.getByRole('region', { name: 'Your feedback' });
  await expect(history).toContainText('Waiting to send');
  await context.setOffline(false);
  await expect(history).not.toContainText('Waiting to send', { timeout: 10_000 });
  await page.reload();
  await expect(history).toContainText('Sent');
});
