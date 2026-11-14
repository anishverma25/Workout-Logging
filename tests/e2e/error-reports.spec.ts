import { expect, test } from '@playwright/test';
import { FAKE_SUPABASE, signUpFresh } from './session';

interface Row {
  kind: string;
  fingerprint: string;
  message: string;
  route: string;
  count: number;
}

async function reports(email: string): Promise<Row[]> {
  const res = await fetch(`${FAKE_SUPABASE}/__test/client-errors`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  expect(res.ok).toBe(true);
  return (await res.json()) as Row[];
}

test('a screen that crashes still shows the crash screen and sends one report', async ({
  page,
}) => {
  const email = await signUpFresh(page, { tag: 'errors' });
  // Signing up counts as an onboarding step (no content, only the step).
  await expect
    .poll(async () => (await reports(email)).map((r) => r.fingerprint))
    .toContain('signed_up');

  await page.goto('/__crash?private=paneer#secret');
  await expect(page.getByRole('heading', { name: 'This screen ran into a problem' })).toBeVisible();
  await expect
    .poll(async () => (await reports(email)).filter((r) => r.kind === 'route'))
    .toHaveLength(1);
  const [crash] = (await reports(email)).filter((r) => r.kind === 'route');
  expect(crash!.route).toBe('/__crash');
  expect(crash!.message).toContain('Test crash for error reports');
  expect(JSON.stringify(crash)).not.toMatch(/paneer|secret|@example\.com/);
});
