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
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', name: 'Macrotrophy' });
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
  // A brand-new install opens with the public home page and its tour, which lead to an account.
  await page.goto('/');
  await page.getByRole('link', { name: 'Take the tour' }).first().click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await page.goto('/sign-up');
  await page.getByRole('textbox', { name: 'Email' }).fill(`pwa-off-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-9');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/import\?welcome=1/);
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
  await expect(page.getByRole('heading', { level: 1, name: 'Account', exact: true })).toBeVisible();
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

test('public pages are readable before scripts and open as pages', async ({ page, request }) => {
  // What a search engine fetches: the guide's text and the home page's structured data.
  const guide = await (await request.get('/workout-tracker')).text();
  expect(guide).toContain('<title>Workout tracker and gym log | Macrotrophy</title>');
  expect(guide).toContain('<main data-static-guide><h1>Workout tracker</h1>');
  const home = await (await request.get('/')).text();
  const data = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(home)?.[1];
  expect(JSON.parse(data!)[0].name).toBe('Macrotrophy');
  expect(await (await request.get('/sitemap.xml')).text()).toContain(
    '/indian-food-calorie-counter',
  );

  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/workout-tracker');
  // The app replaces the plain copy with the same guide as a page: one heading, no duplicate.
  await expect(page.locator('[data-guide="/workout-tracker"]')).toBeVisible();
  await expect(page.locator('[data-static-guide]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await page.goto('/science');
  await expect(
    page.getByRole('heading', { level: 1, name: 'How every number is calculated' }),
  ).toBeVisible();
  await expect(page).toHaveTitle('The science behind every number | Macrotrophy');
  await expect(page.locator('[data-static-page]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms and conditions' })).toBeVisible();
  await expect(page.locator('[data-static-page]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('science and legal text is in the HTML; sign-in and sign-up stay out of search', async ({
  request,
}) => {
  const science = await (await request.get('/science')).text();
  expect(science).toContain('<main data-static-page><h1>How every number is calculated</h1>');
  expect(science).toContain('<h3>Estimated 1RM</h3>');
  expect(science).toContain('"@type":"BreadcrumbList"');
  const terms = await (await request.get('/terms')).text();
  expect(terms).toContain('<h1>Terms and conditions</h1>');
  const contact = await (await request.get('/contact')).text();
  expect(contact).toContain('mailto:team@macrotrophy.in');
  for (const path of ['/sign-in', '/sign-up']) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('<meta name="robots" content="noindex, follow" />');
  }
  expect(await (await request.get('/terms')).text()).not.toContain('noindex');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('/sign-up<');
  expect(sitemap).not.toContain('/sign-in<');
});

/** A Hevy export with two workouts in the week a report can be made for now. */
function hevyWeek(now = new Date()): string {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sundayEvening = new Date(monday);
  sundayEvening.setDate(monday.getDate() + 6);
  sundayEvening.setHours(18, 0, 0, 0);
  const start = new Date(monday);
  if (now < sundayEvening) start.setDate(monday.getDate() - 7);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const at = (offset: number, h: number) => {
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}, ${h}:00`;
  };
  const rows = [
    '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
  ];
  for (const [day, title] of [
    [0, 'Upper'],
    [2, 'Lower'],
  ] as const) {
    const lift = title === 'Upper' ? 'Bench Press (Barbell)' : 'Squat (Barbell)';
    for (const i of [0, 1, 2])
      rows.push(
        `"${title}","${at(day, 18)}","${at(day, 19)}","","${lift}",,"",${i},"normal",80,6,,,8`,
      );
  }
  return rows.join('\n');
}

test('the weekly report PDF downloads under the production security policy', async ({ page }) => {
  test.setTimeout(150_000);
  const { signUpFresh } = await import('./session');
  // The production build has no demo data: two workouts come in through the Hevy import.
  await signUpFresh(page, { at: '/import?next=/report', tag: 'pwa-report' });
  await waitForServiceWorker(page);
  await page.getByRole('radio', { name: /^Hevy/ }).click();
  await page.getByRole('button', { name: 'Continue with Hevy' }).click();
  await page
    .getByLabel('Hevy export file')
    .setInputFiles({ name: 'workouts.csv', mimeType: 'text/csv', buffer: Buffer.from(hevyWeek()) });
  await page.getByRole('button', { name: 'Import 2 workouts' }).click();
  await expect(page.getByRole('heading', { name: 'Your history is in' })).toBeVisible();
  await page.goto('/report');
  await page.locator('[data-report-make]').click();
  await expect(page.locator('[data-report]')).toBeVisible();
  await page.locator('[data-report-download]').click();
  const sheet = page.getByRole('dialog', { name: 'Download your report' });
  const download = page.waitForEvent('download');
  await sheet.locator('[data-report-save-pdf]').click();
  const file = await download;
  const { readFileSync } = await import('node:fs');
  expect(
    readFileSync((await file.path())!)
      .subarray(0, 5)
      .toString(),
  ).toBe('%PDF-');
  // The PDF code is fetched when used, never installed with the app.
  const precached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const n of names) for (const r of await (await caches.open(n)).keys()) urls.push(r.url);
    return urls.filter((u) => /makePdf-|dm-sans-latin-400-normal-[^/]*\.woff$/.test(u));
  });
  expect(precached).toEqual([]);
});
