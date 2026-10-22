import { expect, test, type Page } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * Newer iPhones report a visual viewport shorter than the window by the browser's own toolbars
 * (iOS 18 and 26 Safari). Sheets once read that as an open keyboard and collapsed to their
 * header. Here the viewport is made 114 px short before anything opens, then a real keyboard
 * is added on top.
 */

async function shortViewport(page: Page, px: number) {
  await page.addInitScript((initial) => {
    const w = window as unknown as { __vvShort: number };
    w.__vvShort = initial;
    const vv = window.visualViewport;
    if (vv)
      Object.defineProperty(vv, 'height', {
        configurable: true,
        get: () => window.innerHeight - w.__vvShort,
      });
  }, px);
}

const setShortfall = (page: Page, px: number) =>
  page.evaluate((v) => {
    (window as unknown as { __vvShort: number }).__vvShort = v;
    window.visualViewport?.dispatchEvent(new Event('resize'));
  }, px);

test('sheets keep their size when the browser toolbars shorten the viewport', async ({ page }) => {
  await shortViewport(page, 114);
  await signUpFresh(page, { tag: 'sheet-iphone' });
  await page.goto('/food');
  await expect(page.locator('[data-food-page]')).toBeVisible();

  // The tall logging sheet keeps most of the screen.
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('searchbox')).toBeVisible();
  const win = await page.evaluate(() => window.innerHeight);
  const tall = await sheet.boundingBox();
  expect(tall!.height).toBeGreaterThan(win * 0.6);

  // Some iPhones leave the visual viewport short after the keyboard goes away, or while the
  // browser toolbars move. With no field focused that is not a keyboard.
  await setShortfall(page, 650);
  const stuck = await sheet.boundingBox();
  expect(stuck!.height).toBeGreaterThan(win * 0.6);
  await setShortfall(page, 114);

  // A short sheet shows all of its content, not a sliver.
  await sheet.getByRole('button', { name: /Add your own food or family recipe/ }).click();
  const own = page.getByRole('dialog');
  await expect(own.getByRole('radio', { name: 'Family recipe' })).toBeVisible();
  const body = own.locator('div.overflow-y-auto').first();
  const [client, scroll] = await body.evaluate((el) => [el.clientHeight, el.scrollHeight]);
  expect(client).toBeGreaterThan(150);
  expect(client).toBeGreaterThanOrEqual(Math.min(scroll, win * 0.5));
});

test('a real keyboard still lifts the sheet above it', async ({ page }) => {
  await shortViewport(page, 114);
  await signUpFresh(page, { tag: 'sheet-keyboard' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox').focus();
  await setShortfall(page, 114 + 300);
  const win = await page.evaluate(() => window.innerHeight);
  await expect
    .poll(async () => (await sheet.boundingBox())!.y + (await sheet.boundingBox())!.height)
    .toBeLessThanOrEqual(win - 290);
  expect((await sheet.boundingBox())!.height).toBeGreaterThan(200);
});
