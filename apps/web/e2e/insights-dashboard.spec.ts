/**
 * E2E — Insights dashboard (owner analytics).
 *
 * Uses fresh per-test users so metric assertions are exact and parallel-safe:
 * the owner-with-properties case sees exactly the fixture property, the
 * empty case is guaranteed to have none, and the browser-user case never
 * races on shared OTP cooldowns.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';

test.describe('Insights dashboard — owner with properties', () => {
  test('metric cards show accurate data for an owner with listings', async ({
    page,
    ownerWithProperty,
  }) => {
    await loginAsTestUser(page, ownerWithProperty.owner.phone);
    await goto(page, '/insights');
    await expect(page).toHaveURL(/\/insights$/);

    await expect(page.getByText('Total listings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Total views')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Inquiries')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Top Properties')).toBeVisible();
    await expect(page.getByText('Best performing listings')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Insights dashboard — empty state', () => {
  test('owner with no properties sees empty state and create CTA', async ({ page, ownerUser }) => {
    await loginAsTestUser(page, ownerUser.phone);
    await goto(page, '/insights');
    await expect(page).toHaveURL(/\/insights$/);

    await expect(page.getByText("You haven't created any listings yet")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /create your first listing/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Insights dashboard — browser user', () => {
  test('browser user is redirected from /insights', async ({ page, browserUser }) => {
    await loginAsTestUser(page, browserUser.phone);
    await goto(page, '/insights');
    await expect(page).not.toHaveURL(/\/insights$/);
  });
});
