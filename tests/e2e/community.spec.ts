import { expect, test, type Browser, type Page } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * Community (November 2026, migration 0040) with two real accounts: the rules and a username
 * before the first post, asking anonymously, nothing in another member's page naming the
 * author, Macrotrophy Verified by email from the owner's SQL, Helpful and Best Answer, report
 * and block, and Home and More linking to Leaderboards & Community.
 */

const FAKE = 'http://localhost:54329';

// One switch is global (posting paused), so these run one after another.
test.describe.configure({ mode: 'serial' });

async function owner(fn: string, args: unknown[]) {
  const res = await fetch(`${FAKE}/__test/community-owner`, {
    method: 'POST',
    body: JSON.stringify({ fn, args }),
  });
  return (await res.json()) as { result?: unknown; error?: string };
}

async function secondPerson(browser: Browser) {
  const context = await browser.newContext(test.info().project.use);
  return { context, page: await context.newPage() };
}

/** Opens Ask, picks a username and accepts the rules on the way. */
async function joinCommunity(page: Page, username: string) {
  await page.goto('/community/new?kind=question');
  const form = page.locator('[data-pick-username]');
  await expect(form).toBeVisible();
  await form.getByLabel('Username').fill(username);
  await expect(form.getByText(`@${username} is free.`)).toBeVisible();
  await form.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-rules]')).toBeVisible();
  await page.locator('[data-accept-rules]').click();
  await expect(page.locator('[data-composer]')).toBeVisible();
}

const name = (tag: string) => `${tag}${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

test('ask anonymously, answer as a verified creator, best answer, block and report', async ({ page, browser }) => {
  test.setTimeout(120_000);
  // The asker.
  await signUpFresh(page, { tag: 'asker' });
  const askerName = name('asker');
  await joinCommunity(page, askerName);
  const title = `Protein on a veg diet ${Date.now()}`;
  await page.getByRole('radio', { name: 'Nutrition' }).click();
  await page.locator('[data-title]').fill(title);
  await page.locator('[data-body]').fill('I am at 70 g a day without whey. What do you eat?');
  await page.getByRole('switch', { name: 'Post anonymously' }).click();
  await expect(page.locator('[data-identity-preview]')).toContainText('Anonymous Lifter');
  await page.locator('[data-post-submit]').click();
  await expect(page).toHaveURL(/\/community\/p\//);
  const postUrl = page.url();
  await expect(page.locator('[data-post-title]')).toHaveText(title);
  await expect(page.locator('[data-post-page] [data-author-anon]').first()).toContainText('Anonymous Lifter');

  // The creator, verified by the owner by email.
  const other = await secondPerson(browser);
  const creatorEmail = await signUpFresh(other.page, { tag: 'creator' });
  const creatorName = name('coach');
  await joinCommunity(other.page, creatorName);
  expect((await owner('community_owner_verify', [creatorEmail])).result).toBe(`Verified: @${creatorName}`);

  // The creator sees the question with no trace of who asked.
  await other.page.goto(postUrl);
  await expect(other.page.locator('[data-post-title]')).toHaveText(title);
  const html = await other.page.content();
  expect(html).not.toContain(askerName);
  await expect(other.page.locator('[data-post-page] header').first()).toContainText('Anonymous Lifter');

  // Answers with the username: the badge shows.
  await other.page.locator('[data-reply-body]').fill('Soya chunks: about 52 g protein per 100 g dry. A katori at lunch adds 25 g.');
  await other.page.locator('[data-send-reply]').click();
  const reply = other.page.locator('[data-reply]').filter({ hasText: 'Soya chunks' });
  await expect(reply).toBeVisible();
  await expect(reply.locator('[data-verified]')).toBeVisible();

  // The asker marks it helpful and the best answer, and sees the activity.
  await page.goto('/community/activity');
  await expect(page.locator('[data-activity="reply"]').first()).toContainText(`@${creatorName}`);
  await page.goto(postUrl);
  const answer = page.locator('[data-reply]').filter({ hasText: 'Soya chunks' });
  await answer.locator('[data-helpful]').click();
  await expect(answer.locator('[data-helpful]')).toHaveAttribute('aria-pressed', 'true');
  await answer.locator('[data-mark-best]').click();
  await expect(page.locator('[data-best]')).toBeVisible();

  // The owner removes the badge: it goes, nothing else changes.
  expect((await owner('community_owner_unverify', [creatorEmail])).result).toBe(`No longer verified: @${creatorName}`);
  await page.reload();
  await expect(page.locator('[data-reply]').filter({ hasText: 'Soya chunks' }).locator('[data-verified]')).toHaveCount(0);

  // The creator reports and blocks the anonymous asker, without ever seeing who it is.
  await other.page.goto(postUrl);
  await other.page.locator('[data-post-menu]').click();
  await other.page.getByRole('menuitem', { name: 'Report' }).click();
  await other.page.locator('[data-reason="spam"]').click();
  await other.page.locator('[data-send-report]').click();
  await expect(other.page.getByText('Thanks. We will check it.')).toBeVisible();
  await other.page.locator('[data-post-menu]').click();
  await other.page.getByRole('menuitem', { name: 'Block this anonymous author' }).click();
  await other.page.getByRole('button', { name: 'Block', exact: true }).click();
  await expect(other.page).toHaveURL(/\/community$/);
  await other.page.goto('/community/mine');
  await expect(other.page.getByText('Blocked')).toBeVisible();
  expect(await other.page.content()).not.toContain(askerName);
  await other.page.goto(postUrl);
  await expect(other.page.getByText('This post is not available')).toBeVisible();
  await other.context.close();
});

test('Home and More lead to Leaderboards & Community, one switch between them', async ({ page }) => {
  await signUpFresh(page, { tag: 'hub' });
  await expect(page.getByRole('heading', { name: 'Leaderboards & Community' })).toBeVisible();
  await page.locator('[data-home-community]').click();
  await expect(page).toHaveURL(/\/community$/);
  await expect(page.getByRole('link', { name: 'Back to Home' })).toBeVisible();
  await page.getByRole('radio', { name: 'Leaderboards' }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole('heading', { name: 'Leaderboards', level: 1 })).toBeVisible();
  await page.getByRole('radio', { name: 'Community' }).click();
  await expect(page).toHaveURL(/\/community$/);
  await page.goto('/more');
  await page.getByRole('navigation', { name: 'More' }).getByRole('link', { name: /Leaderboards & Community/ }).click();
  await expect(page).toHaveURL(/\/community$/);
});

test('posting can be paused by the owner without breaking reading', async ({ page }) => {
  await signUpFresh(page, { tag: 'paused' });
  await joinCommunity(page, name('pause'));
  expect((await owner('community_owner_switch', ['community_posting', false])).error).toBeUndefined();
  try {
    await page.goto('/community/new?kind=journey');
    await expect(page.locator('[data-write-blocked="paused"]')).toBeVisible();
    await page.goto('/community');
    await expect(page.locator('[data-community-page]')).toBeVisible();
  } finally {
    await owner('community_owner_switch', ['community_posting', true]);
  }
});
