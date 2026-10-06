import { expect, test, type Page } from '@playwright/test';

/**
 * The production build: installable, opens offline, sends security headers, and never caches
 * private data. Runs against `vite preview` of a `--mode e2e` build.
 */

const cspViolations: string[] = [];

test.beforeEach(async ({ page }) => {
  cspViolations.length = 0;
  page.on('pageerror', (e) => {
    throw e;
  });
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) cspViolations.push(msg.text());
  });
});

test.afterEach(() => {
  expect(cspViolations, 'Content Security Policy violations').toEqual([]);
});

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
}

test('is installable: manifest, icons and theme', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', name: 'Overload' });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

test('sends security headers', async ({ request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain('connect-src');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('opens and works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByText('Offline. Everything you log is saved on this device.'),
  ).toBeVisible();

  // Screens that load on demand are cached too.
  await page.goto('/history');
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible();
  await page.goto('/body');
  await page
    .getByRole('button', { name: /weigh-in/i })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('radio', { name: 'kg' }).click();
  await page.getByRole('textbox', { name: 'Weight' }).fill('72.4');
  await page.getByRole('button', { name: 'Save weigh-in' }).click();
  await expect(page.getByText('Weigh-in saved')).toBeVisible();

  // Still there after closing and reopening, without a network.
  await page.reload();
  await expect(page.getByRole('button', { name: /72\.4 kg/ }).first()).toBeVisible();
  await context.setOffline(false);
});

test('caches only the app itself, never account or training data from the server', async ({
  page,
}) => {
  await page.goto('/sign-up?next=/account');
  await waitForServiceWorker(page);
  await page.getByRole('textbox', { name: 'Email' }).fill(`pwa-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-9');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Sync status' })).toContainText(
    'Synced to your account',
    {
      timeout: 15_000,
    },
  );

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) urls.push(req.url);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(5);
  for (const url of cached) {
    const { origin, pathname } = new URL(url);
    expect(origin, url).toBe('http://localhost:4175');
    expect(pathname, url).not.toMatch(/^\/(rest|auth)\//);
  }
});
