import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

const PAGES = [
  { path: '/terms', title: 'Terms and conditions' },
  { path: '/privacy', title: 'Privacy policy' },
  { path: '/refunds', title: 'Cancellation and refund policy' },
  { path: '/contact', title: 'Contact us' },
];

for (const { path, title } of PAGES) {
  test(`the ${title} page opens for anyone and fits the screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText(/Last updated/)).toBeVisible();
    // The other legal pages are one tap away.
    const legal = page.getByRole('navigation', { name: 'Legal' });
    await expect(legal.getByRole('link')).toHaveCount(4);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    expect(await page.locator('body').innerText()).not.toContain('—');
  });
}

test('the contact page shows who runs Overload and how to reach them', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByText('Anish Verma, India', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'anish.verma.2505@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:anish.verma.2505@gmail.com',
  );
  await expect(page.getByRole('link', { name: '+91 82768 81982' })).toHaveAttribute(
    'href',
    'tel:+918276881982',
  );
});

test('the refund policy says plainly that payments are not refunded', async ({ page }) => {
  await page.goto('/refunds');
  await expect(page.getByRole('heading', { name: 'No refunds' })).toBeVisible();
  await expect(page.getByText('Payments for Pro are not refundable.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cancel any time' })).toBeVisible();
});

test('sign up and the Pro page link to the policies', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByRole('link', { name: 'Terms', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms and conditions' })).toBeVisible();
  await signUpFresh(page, { at: '/pro', tag: 'legal' });
  await page
    .getByRole('navigation', { name: 'Legal' })
    .getByRole('link', { name: 'Cancellation and refunds' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Cancellation and refund policy' }),
  ).toBeVisible();
});
