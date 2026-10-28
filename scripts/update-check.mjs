// Update check: what people with the app already open actually go through when a new version
// ships. Builds the version that is live now (the deployed branch) and this code, serves them
// the way Cloudflare Pages does, and for each step: signs in on the older version, publishes the
// newer one, lets the app find it, taps Reload, and checks the newer version really opened (and
// opens again from cold). Then the same from this code to a later version of itself.
//
// Run: pnpm test:update   (UPDATE_FROM_REF picks the live version, default origin/phase-2-wip)
// Needs: the fake Supabase (started here if it is not running) and Playwright's Chromium.
import { execSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const ROOT = resolve('.');
const WORK = join(ROOT, '.update-check');
const PORT = 4310;
const BASE = `http://localhost:${PORT}`;
const sh = (cmd, cwd = ROOT) =>
  execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'] })
    .toString()
    .trim();

// 1. The versions: live now, this code, and this code again under a new version name.
rmSync(WORK, { recursive: true, force: true });
const fromRef = process.env.UPDATE_FROM_REF ?? 'origin/phase-2-wip';
let from = sh(`git rev-parse ${fromRef}`);
// On the deployed branch itself, the version before this commit is the one people have.
if (sh(`git rev-parse ${from}^{tree}`) === sh('git rev-parse HEAD^{tree}'))
  from = sh('git rev-parse HEAD~1');
console.log(`Live version: ${from.slice(0, 7)}; this code: ${sh('git rev-parse --short HEAD')}`);
const prevSrc = join(WORK, 'src-prev');
sh(`git worktree add --detach --force ${prevSrc} ${from}`);
symlinkSync(join(ROOT, 'node_modules'), join(prevSrc, 'node_modules'));
cpSync(join(ROOT, '.env.e2e'), join(prevSrc, '.env.e2e'));
const build = (cwd, out) =>
  sh(`pnpm exec vite build --mode e2e --outDir ${out} --emptyOutDir`, cwd);
build(prevSrc, join(WORK, 'prev'));
build(ROOT, join(WORK, 'cur'));
cpSync(join(WORK, 'cur'), join(WORK, 'next'), { recursive: true });
const swNext = join(WORK, 'next', 'sw.js');
writeFileSync(
  swNext,
  readFileSync(swNext, 'utf8').replace(/const VERSION = '([^']*)'/, "const VERSION = '$1-next'"),
);

// 2. Hosting like Cloudflare Pages: files, pretty .html addresses, index.html for anything else,
// and the `/*` headers (the Content Security Policy matters). GET /__use/<name> switches build.
let current = 'prev';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};
function headersFor(dir) {
  const block = readFileSync(join(dir, '_headers'), 'utf8')
    .split(/\n(?=\/)/)[0]
    .split('\n')
    .slice(1);
  return Object.fromEntries(
    block
      .map((l) => /^\s+([^:]+):\s*(.*)$/.exec(l))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname.startsWith('/__use/')) {
    current = url.pathname.slice(7);
    return res.end(current);
  }
  const dir = join(WORK, current);
  let file = join(dir, decodeURIComponent(url.pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && existsSync(`${file}.html`)) file += '.html';
  if (!existsSync(file)) file = join(dir, 'index.html');
  const headers = {
    ...headersFor(dir),
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
  };
  if (/(sw\.js|\.html)$/.test(file)) headers['Cache-Control'] = 'no-cache';
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(PORT);
const use = (v) => fetch(`${BASE}/__use/${v}`);

let fake = null;
const fakeUp = () =>
  fetch('http://localhost:54329/health').then(
    (r) => r.ok,
    () => false,
  );
if (!(await fakeUp())) {
  fake = spawn('node', ['tests/fake-supabase/server.ts'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await fakeUp()); i++) await new Promise((r) => setTimeout(r, 500));
}

// 3. The steps.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const failures = [];
const state = (page) =>
  page.evaluate(() => ({
    reloaded: !window.__beforeUpdate,
    main: [...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? '',
    help: !!document.getElementById('boot-help'),
    drawn: (document.getElementById('root')?.childElementCount ?? 0) > 0,
  }));

/** The release announcement of the version a step starts on, marked seen so it covers nothing. */
const releaseId = (src) =>
  /RELEASE_ID = '([^']+)'/.exec(
    readFileSync(join(src, 'src/app/layout/whatsNewStore.ts'), 'utf8'),
  )?.[1] ?? '';
const RELEASES = { prev: releaseId(prevSrc), cur: releaseId(ROOT) };

async function update(fromBuild, toBuild) {
  const name = `${fromBuild} -> ${toBuild}`;
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((id) => {
    try {
      localStorage.setItem('overload.whatsNew', id);
    } catch {}
  }, RELEASES[fromBuild]);
  const page = await ctx.newPage();
  try {
    await use(fromBuild);
    await page.goto(`${BASE}/sign-up?next=/more`);
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(`update-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('correct-horse-9');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(/\/more/, { timeout: 30_000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30_000 });
    await page.waitForTimeout(1500);

    await use(toBuild);
    await page.evaluate(() => {
      window.__beforeUpdate = true;
    });
    // Coming back to the front makes the app look for a new version.
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await page.getByText('A new version is ready').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Reload' }).first().click();
    await page
      .waitForFunction(() => !window.__beforeUpdate, null, { timeout: 15_000 })
      .catch(() => {});
    await page.waitForTimeout(3000);
    const after = await state(page);
    const want =
      (await (await fetch(`${BASE}/`)).text()).match(/\/assets\/index-[^"]+\.js/)?.[0] ?? '';
    if (!after.reloaded) throw new Error('Reload did nothing');
    if (!after.drawn || after.help) throw new Error('the app did not open after Reload');
    if (!after.main.endsWith(want))
      throw new Error(`still on the old version after Reload (${after.main})`);
    const workers = await page.evaluate(async () => (await caches.keys()).join(','));
    if (toBuild === 'next' && !workers.includes('-next'))
      throw new Error('the next version did not take over');

    // Opening again from cold.
    const again = await ctx.newPage();
    await again.goto(`${BASE}/more`);
    await again.waitForTimeout(4000);
    const cold = await state(again);
    if (!cold.drawn || cold.help)
      throw new Error('the app did not open from cold after the update');
    if (!cold.main.endsWith(want)) throw new Error('opening from cold gave the old version');
    console.log(`PASS ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`FAIL ${name}: ${err.message}`);
  } finally {
    await ctx.close();
  }
}

await update('prev', 'cur');
await update('cur', 'next');

await browser.close();
server.close();
fake?.kill();
sh(`git worktree remove --force ${prevSrc}`);
if (failures.length) {
  console.error(`\nUpdate check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(
  '\nUpdate check passed: people with the app open get the new version when they tap Reload.',
);
