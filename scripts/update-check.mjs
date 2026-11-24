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
// UPDATE_REUSE=1 reuses the builds of the last run (for working on the steps themselves).
const reuse = process.env.UPDATE_REUSE === '1' && existsSync(join(WORK, 'next', 'sw.js'));
if (!reuse) rmSync(WORK, { recursive: true, force: true });
const fromRef = process.env.UPDATE_FROM_REF ?? 'origin/phase-2-wip';
let from = sh(`git rev-parse ${fromRef}`);
// On the deployed branch itself, the version before this commit is the one people have.
if (sh(`git rev-parse ${from}^{tree}`) === sh('git rev-parse HEAD^{tree}'))
  from = sh('git rev-parse HEAD~1');
console.log(`Live version: ${from.slice(0, 7)}; this code: ${sh('git rev-parse --short HEAD')}`);
const prevSrc = join(WORK, 'src-prev');
const build = (cwd, out) =>
  // The demo athlete can be loaded in these builds, to update an account with real history.
  sh(`VITE_DEMO_AUTOLOAD=true pnpm exec vite build --mode e2e --outDir ${out} --emptyOutDir`, cwd);
if (!reuse) {
  sh(`git worktree add --detach --force ${prevSrc} ${from}`);
  symlinkSync(join(ROOT, 'node_modules'), join(prevSrc, 'node_modules'));
  cpSync(join(ROOT, '.env.e2e'), join(prevSrc, '.env.e2e'));
  build(prevSrc, join(WORK, 'prev'));
  build(ROOT, join(WORK, 'cur'));
  cpSync(join(WORK, 'cur'), join(WORK, 'next'), { recursive: true });
}
const swNext = join(WORK, 'next', 'sw.js');
if (!reuse)
  writeFileSync(
    swNext,
    readFileSync(swNext, 'utf8').replace(/const VERSION = '([^']*)'/, "const VERSION = '$1-next'"),
  );

// 2. Hosting like Cloudflare Pages: files, pretty .html addresses, the nearest 404.html for a
// missing file (index.html when there is none: Pages then assumes a single-page app), and every
// `_headers` block that matches (the CSP and the caching both matter). GET /__use/<name>
// switches build. GET /__lag/<name> starts a deploy that has not reached every data centre yet:
// app files are answered by that older build, as Cloudflare did on November 24, 2026 (the new
// page and worker, but the old deployment's answer for the new file names).
let current = 'prev';
/** While set, /assets/ requests are answered by this older build. */
let lag = null;
/** While on, script files fail to download: an update cut off halfway. */
let broken = false;
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
function headersFor(dir, pathname) {
  const out = {};
  for (const block of readFileSync(join(dir, '_headers'), 'utf8').split(/\n(?=\/)/)) {
    const [rule, ...lines] = block.split('\n');
    const pattern = rule.trim();
    const hit = pattern.endsWith('*')
      ? pathname.startsWith(pattern.slice(0, -1))
      : pathname === pattern;
    if (!hit) continue;
    for (const l of lines) {
      const m = /^\s+([^:]+):\s*(.*)$/.exec(l);
      if (m) out[m[1]] = m[2];
    }
  }
  // Pages' own default for anything the file does not set.
  out['Cache-Control'] ??= 'public, max-age=0, must-revalidate';
  return out;
}
/** The nearest 404.html above a missing path, or null (single-page app: index.html). */
function notFoundPage(dir, pathname) {
  let at = pathname.replace(/\/[^/]*$/, '');
  for (;;) {
    const page = join(dir, at, '404.html');
    if (existsSync(page)) return page;
    if (!at) return null;
    at = at.replace(/\/[^/]*$/, '');
  }
}
const server = createServer((req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname.startsWith('/__use/')) {
    current = url.pathname.slice(7);
    return res.end(current);
  }
  if (url.pathname.startsWith('/__lag/')) {
    lag = url.pathname.slice(7) || null;
    return res.end(String(lag));
  }
  if (url.pathname.startsWith('/__break/')) {
    broken = url.pathname.endsWith('/on');
    return res.end(String(broken));
  }
  if (broken && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js')) {
    res.writeHead(503);
    return res.end();
  }
  const dir = join(WORK, lag && url.pathname.startsWith('/assets/') ? lag : current);
  let file = join(dir, decodeURIComponent(url.pathname));
  let status = 200;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && existsSync(`${file}.html`)) file += '.html';
  if (!existsSync(file)) {
    const missing = notFoundPage(dir, url.pathname);
    if (missing) {
      file = missing;
      status = 404;
    } else file = join(dir, 'index.html');
  }
  const headers = {
    ...headersFor(dir, url.pathname),
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
  };
  res.writeHead(status, headers);
  res.end(readFileSync(file));
}).listen(PORT);
const lagBehind = (v) => fetch(`${BASE}/__lag/${v ?? ''}`);
const use = (v) => fetch(`${BASE}/__use/${v}`);
const breakDownloads = (on) => fetch(`${BASE}/__break/${on ? 'on' : 'off'}`);

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
    errs: window.__overload?.errors ?? [],
    drawn: (document.getElementById('root')?.childElementCount ?? 0) > 0,
  }));

/** How many workouts and sets the phone holds, read straight from its databases. */
const records = (page) =>
  page.evaluate(async () => {
    let workouts = 0;
    let sets = 0;
    for (const info of await indexedDB.databases()) {
      if (!info.name) continue;
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(info.name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const count = (store) =>
        db.objectStoreNames.contains(store)
          ? new Promise((resolve) => {
              const req = db.transaction(store).objectStore(store).count();
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => resolve(0);
            })
          : 0;
      workouts += await count('workouts');
      sets += await count('sets');
      db.close();
    }
    return { workouts, sets };
  });

/** Signs up on the version being served and waits until its offline copy is in charge. */
async function signUp(page) {
  await page.goto(`${BASE}/sign-up?next=/more`);
  await page
    .getByRole('textbox', { name: 'Email' })
    .fill(`update-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-9');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/more/, { timeout: 30_000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

/** Weeks of training in the account, as a member has. */
async function loadTraining(page) {
  await page.goto(`${BASE}/settings`);
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await page
    .locator('#demo-data')
    .getByRole('status')
    .filter({ hasText: 'workouts' })
    .waitFor({ timeout: 60_000 });
}

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
    await signUp(page);
    // A member with real history: every workout and set must still be there afterwards.
    await loadTraining(page);
    const before = await records(page);
    if (before.workouts < 10 || before.sets < 100)
      throw new Error(`the training history did not load (${before.workouts} workouts)`);
    await page.goto(`${BASE}/more`);
    await page.waitForTimeout(1000);

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
    const kept = await records(again);
    if (kept.workouts !== before.workouts || kept.sets !== before.sets)
      throw new Error(
        `training changed in the update: ${before.workouts} workouts and ${before.sets} sets before, ${kept.workouts} and ${kept.sets} after`,
      );
    await again.close();

    // With no connection at all, the updated app still opens with the history in it.
    await ctx.setOffline(true);
    const off = await ctx.newPage();
    await off.goto(`${BASE}/history`);
    await off.waitForTimeout(4000);
    const offline = await state(off);
    if (!offline.drawn || offline.help)
      throw new Error('the app did not open offline after the update');
    if (!offline.main.endsWith(want)) throw new Error('offline opened the old version');
    await ctx.setOffline(false);
    console.log(`PASS ${name} (${kept.workouts} workouts kept, opens offline)`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`FAIL ${name}: ${err.message}`);
  } finally {
    await ctx.close();
  }
}

/**
 * An update cut off halfway (the connection drops while the new files download): the version
 * the person has must keep opening, online and offline, and the update must finish next time.
 */
async function interrupted(fromBuild, toBuild) {
  const name = `${fromBuild} -> ${toBuild}, cut off halfway`;
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((id) => {
    try {
      localStorage.setItem('overload.whatsNew', id);
    } catch {}
  }, RELEASES[fromBuild]);
  const page = await ctx.newPage();
  try {
    await use(fromBuild);
    await signUp(page);
    // Sign up opens setup (stage A), a full-screen page with no update notice: wait on More,
    // where people see "A new version is ready", as the other steps do.
    await page.goto(`${BASE}/more`);
    await page.waitForTimeout(1000);
    const old = (await state(page)).main;

    await breakDownloads(true);
    await use(toBuild);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await page.waitForTimeout(6000);
    // Nothing half-installed took over: a reload and a cold start still open the old version.
    await page.reload();
    await page.waitForTimeout(4000);
    const stuck = await state(page);
    if (!stuck.drawn || stuck.help)
      throw new Error('the app stopped opening after a failed update');
    if (stuck.main !== old) throw new Error('a half-downloaded version took over');
    await ctx.setOffline(true);
    const off = await ctx.newPage();
    await off.goto(`${BASE}/more`);
    await off.waitForTimeout(4000);
    const offline = await state(off);
    if (!offline.drawn || offline.help)
      throw new Error('the app did not open offline after a failed update');
    await off.close();
    await ctx.setOffline(false);

    // The connection is back: the update goes through as usual.
    await breakDownloads(false);
    await page.evaluate(() => {
      window.__beforeUpdate = true;
    });
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
    if (!after.drawn || after.help)
      throw new Error('the app did not open after the retried update');
    if (!after.main.endsWith(want)) throw new Error('the retried update did not take over');
    console.log(`PASS ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`FAIL ${name}: ${err.message}`);
  } finally {
    await breakDownloads(false);
    await ctx.close();
  }
}

/**
 * A deploy that has not reached every data centre yet (November 24, 2026): the new page and
 * worker arrive, but the new app files are still answered by the older deployment. The version
 * the person has must keep opening, and the update must go through once the deploy is complete.
 */
async function propagating(fromBuild, toBuild) {
  const name = `${fromBuild} -> ${toBuild}, deploy still spreading`;
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((id) => {
    try {
      localStorage.setItem('overload.whatsNew', id);
    } catch {}
  }, RELEASES[fromBuild]);
  const page = await ctx.newPage();
  try {
    await use(fromBuild);
    await signUp(page);
    await page.goto(`${BASE}/more`);
    await page.waitForTimeout(1000);
    const old = (await state(page)).main;

    await use(toBuild);
    await lagBehind(fromBuild);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await page.waitForTimeout(12_000);
    for (const label of ['a reload', 'a cold start']) {
      const p = label === 'a reload' ? page : await ctx.newPage();
      if (label === 'a reload') await p.reload();
      else await p.goto(`${BASE}/more`);
      await p.waitForTimeout(5000);
      const now = await state(p);
      if (!now.drawn || now.help)
        throw new Error(
          `the app stopped opening after ${label} mid-deploy: ${JSON.stringify(now.errs)}`,
        );
      if (now.main !== old) throw new Error(`a half-deployed version took over (${now.main})`);
      if (p !== page) await p.close();
    }

    // The deploy reaches every data centre: the update goes through as usual.
    await lagBehind(null);
    if (process.env.UPDATE_DEBUG) {
      ctx.on('console', (m) => console.log('  [console]', m.text()));
      const r = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        try {
          await reg.update();
        } catch (e) {
          return 'update threw ' + e.message;
        }
        await new Promise((r) => setTimeout(r, 8000));
        return JSON.stringify({
          installing: reg.installing?.state,
          waiting: reg.waiting?.state,
          active: reg.active?.state,
          caches: await caches.keys(),
        });
      });
      console.log('  [debug] after update', r);
    }
    await page.evaluate(() => {
      window.__beforeUpdate = true;
    });
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await page
      .getByText('A new version is ready')
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(async (err) => {
        const why = await page.evaluate(async () => {
          const r = await navigator.serviceWorker.getRegistration();
          return {
            installing: r?.installing?.state,
            waiting: r?.waiting?.state,
            active: r?.active?.scriptURL && r.active.state,
            caches: await caches.keys(),
          };
        });
        throw new Error(`no update notice after the deploy finished ${JSON.stringify(why)}`, {
          cause: err,
        });
      });
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Reload' }).first().click();
    await page
      .waitForFunction(() => !window.__beforeUpdate, null, { timeout: 15_000 })
      .catch(() => {});
    await page.waitForTimeout(4000);
    const want =
      (await (await fetch(`${BASE}/`)).text()).match(/\/assets\/index-[^"]+\.js/)?.[0] ?? '';
    const after = await state(page);
    if (!after.drawn || after.help)
      throw new Error(
        'the app did not open after the deploy finished: ' + JSON.stringify(after.errs),
      );
    if (!after.main.endsWith(want)) throw new Error('the update did not take over afterwards');
    const cold = await ctx.newPage();
    await cold.goto(`${BASE}/more`);
    await cold.waitForTimeout(5000);
    const c = await state(cold);
    if (!c.drawn || c.help || !c.main.endsWith(want))
      throw new Error('a cold start after the update failed: ' + JSON.stringify(c.errs));
    console.log(`PASS ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`FAIL ${name}: ${err.message}`);
  } finally {
    await lagBehind(null);
    await ctx.close();
  }
}

/**
 * Someone opening the site for the first time while a deploy spreads: the browser saves the old
 * deployment's answer under the new file names (the page, cached for a year by the old
 * headers). Once the deploy is complete, "Repair and open" must bring the app up.
 */
async function firstVisitMidDeploy(fromBuild, toBuild) {
  const name = `first visit while ${toBuild} spreads, then Repair and open`;
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  try {
    await use(toBuild);
    await lagBehind(fromBuild);
    await page.goto(`${BASE}/sign-in`);
    await page.waitForTimeout(3000);
    await lagBehind(null);
    await page.reload();
    await page.waitForTimeout(8000);
    const stuck = await state(page);
    console.log(`  after a plain reload: ${stuck.drawn && !stuck.help ? 'opened' : 'stuck'}`);
    if (!stuck.drawn || stuck.help) {
      await page.getByRole('button', { name: 'Repair and open' }).click();
      await page.waitForTimeout(10_000);
    }
    const after = await state(page);
    if (!after.drawn || after.help)
      throw new Error('Repair and open did not bring the app up: ' + JSON.stringify(after.errs));
    console.log(`PASS ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`FAIL ${name}: ${err.message}`);
  } finally {
    await lagBehind(null);
    await ctx.close();
  }
}

const only = process.env.UPDATE_ONLY;
const run = (key, fn) => (!only || only.split(',').includes(key) ? fn() : null);
await run('propagating', () => propagating('prev', 'cur'));
await run('firstVisit', () => firstVisitMidDeploy('prev', 'cur'));
await run('update', () => update('prev', 'cur'));
await run('update-next', () => update('cur', 'next'));
await run('interrupted', () => interrupted('prev', 'cur'));

await browser.close();
server.close();
fake?.kill();
if (!process.env.UPDATE_KEEP) sh(`git worktree remove --force ${prevSrc}`);
if (failures.length) {
  console.error(`\nUpdate check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(
  '\nUpdate check passed: people with the app open get the new version when they tap Reload, keep their training, can open it offline, and survive an update cut off halfway or a deploy that is still spreading.',
);
