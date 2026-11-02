import { expect, test, type Browser, type Page } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * Friends, groups and leaderboards (November 2026) with two real accounts: unique usernames,
 * creating a group, joining it by typing the code, points from a real logged workout, who
 * trained today, the home card, admin controls and privacy.
 */

const FAKE = 'http://localhost:54329';
const IPHONE_16 = { width: 393, height: 852 };

async function secondPerson(browser: Browser) {
  const context = await browser.newContext(test.info().project.use);
  const page = await context.newPage();
  return { context, page };
}

async function pickUsername(page: Page, name: string) {
  await page.goto('/groups');
  const form = page.locator('[data-pick-username]');
  await expect(form).toBeVisible();
  await form.getByLabel('Username').fill(name);
  await expect(form.getByText(`@${name.toLowerCase()} is free.`)).toBeVisible();
  await form.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-my-username]')).toHaveText(`@${name.toLowerCase()}`);
}

/** Logs a short workout of three working sets, then stretches it to 30 minutes on the server. */
async function logWorkout(page: Page, email: string) {
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('pec deck');
  await page.getByRole('button', { name: /^Pec deck/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  for (const n of [1, 2, 3]) {
    const load = card.getByRole('textbox', { name: `Set ${n} load in kg` });
    if (!(await load.count())) await card.getByRole('button', { name: 'Add set' }).click();
    await load.fill('40');
    await card.getByRole('textbox', { name: `Set ${n} reps` }).fill('10');
    await card.getByRole('button', { name: `Mark set ${n} done` }).click();
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish and save' }).click();
  await expect(page).toHaveURL(/summary/);
  // Wait for the workout to reach the server, then stand in for 30 minutes of training.
  await expect
    .poll(
      async () => {
        const res = await fetch(`${FAKE}/__test/stretch-workouts`, {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        return ((await res.json()) as { changed: number }).changed;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
}

async function noSideScroll(page: Page) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(1);
}

test('two friends: username, create, join by code, points, home card and admin', async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize(IPHONE_16);
  const anishEmail = await signUpFresh(page, { tag: 'grp-a' });
  const unique = `ani${Date.now().toString(36).slice(-6)}`;
  await pickUsername(page, unique.toUpperCase());

  // Create a group: the code is shown with a Share button.
  await page.locator('[data-open-create-group]').click();
  const create = page.getByRole('dialog', { name: 'Create a group' });
  await create.getByLabel('Group name').fill('Iron Squad');
  await create.locator('[data-create-group]').click();
  await expect(page).toHaveURL(/\/groups\/[^/]+\?new=1$/);
  await expect(page.locator('[data-invite]')).toContainText('Your group is ready');
  const code = (await page.locator('[data-group-code]').getAttribute('data-group-code'))!;
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await expect(page.locator('[data-board-row]')).toHaveCount(1);
  await noSideScroll(page);

  // A friend on another phone: the same username is taken, whatever the capitals.
  const friend = await secondPerson(browser);
  await friend.page.setViewportSize({ width: 360, height: 780 });
  const friendEmail = await signUpFresh(friend.page, { tag: 'grp-b' });
  await friend.page.goto('/groups');
  const form = friend.page.locator('[data-pick-username]');
  await form.getByLabel('Username').fill(unique);
  await expect(form.getByText('That username is taken')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await pickUsername(friend.page, `${unique}.b`);

  // Joining: the code typed in lower case with a dash.
  await friend.page.locator('[data-open-join-group]').click();
  const join = friend.page.getByRole('dialog', { name: 'Join with a code' });
  await join.getByLabel('Group code').fill(`${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`);
  await join.locator('[data-join-group]').click();
  await expect(friend.page).toHaveURL(/\/groups\/[^/?]+$/);
  await expect(friend.page.locator('[data-board-row]')).toHaveCount(2);
  await expect(friend.page.locator('[data-me]')).toContainText(`@${unique}.b`);
  await noSideScroll(friend.page);

  // Anish trains: 1 workout (10) and 3 hard sets (3) = 13 points, top of the board.
  await logWorkout(page, anishEmail);
  await friend.page.reload();
  const top = friend.page.locator('[data-board-row]').first();
  await expect(top).toHaveAttribute('data-board-row', unique);
  await expect(top).toContainText('13');
  await expect(friend.page.locator('[data-trained-today]')).toContainText('1 of 2');
  // The breakdown shows how the points add up, and nothing about the workout itself.
  await top.getByRole('button').click();
  const breakdown = top.locator('[data-breakdown]');
  await expect(breakdown).toContainText('Workouts');
  await expect(breakdown).toContainText('= 10 pts');
  await expect(breakdown).toContainText('= 3 pts');
  await expect(top).not.toContainText('Pec deck');
  await expect(top).not.toContainText('40');

  // The friend's home card shows the chase.
  await friend.page.goto('/groups');
  await expect(friend.page.locator('[data-group-row="Iron Squad"]')).toContainText(
    `13 points behind @${unique}`,
  );

  // Anish's Home card shows the group once he has training.
  await page.goto('/');
  await expect(page.locator('[data-home-group="Iron Squad"]')).toContainText('#1');

  // Admin: rename and remove the friend, who then loses access.
  await page.goto('/groups');
  await page.locator('[data-group-row="Iron Squad"]').click();
  await page.locator('[data-group-menu]').click();
  await page.getByRole('menuitem', { name: 'Rename group' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename group' });
  await rename.getByLabel('Group name').fill('Iron Squad 2');
  await rename.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Iron Squad 2' })).toBeVisible();
  await page.locator('[data-group-menu]').click();
  await page.getByRole('menuitem', { name: 'Remove someone' }).click();
  await page.locator(`[data-remove-member="${unique}.b"]`).click();
  await page
    .getByRole('dialog', { name: `Remove @${unique}.b?` })
    .getByRole('button', {
      name: 'Remove',
    })
    .click();
  await expect(page.locator('[data-board-row]')).toHaveCount(1);
  await friend.page.goto('/groups');
  await expect(friend.page.locator('[data-no-groups]')).toBeVisible();
  void friendEmail;
  await friend.context.close();
});

test('a wrong code and a free account see plain messages; leaving the last seat deletes it', async ({
  page,
}) => {
  await signUpFresh(page, { tag: 'grp-c' });
  await pickUsername(page, `solo${Date.now().toString(36).slice(-6)}`);
  await page.locator('[data-open-join-group]').click();
  const join = page.getByRole('dialog', { name: 'Join with a code' });
  await join.getByLabel('Group code').fill('ZZZZZZ');
  await join.locator('[data-join-group]').click();
  await expect(join).toContainText('No group has that code');
  await join.getByRole('button', { name: 'Close' }).click();

  await page.locator('[data-open-create-group]').click();
  const create = page.getByRole('dialog', { name: 'Create a group' });
  await create.getByLabel('Group name').fill('Just me');
  await create.locator('[data-create-group]').click();
  await expect(page.locator('[data-invite]')).toBeVisible();
  await page.locator('[data-group-menu]').click();
  await page.getByRole('menuitem', { name: 'Leave group' }).click();
  const leave = page.getByRole('dialog', { name: 'Leave Just me?' });
  await expect(leave).toContainText('the group will be deleted');
  await leave.getByRole('button', { name: 'Leave group' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.locator('[data-no-groups]')).toBeVisible();
});

test('the science page explains the score', async ({ page }) => {
  await signUpFresh(page, { tag: 'grp-sci' });
  await page.goto('/science#leaderboards');
  await expect(page.getByRole('heading', { name: 'Group leaderboards' }).first()).toBeVisible();
});
