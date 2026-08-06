/**
 * E2E — Profile page views by role (PRD §7).
 *
 * Uses fresh per-test users so the profile assertions (name, role badge,
 * role-specific links) are exact and parallel-safe.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';

test.describe('Profile page — OWNER view', () => {
  test('owner sees Insights and My Properties links', async ({ page, ownerUser }) => {
    await loginAsTestUser(page, ownerUser.phone);
    await goto(page, '/profile');
    await expect(page).toHaveURL(/\/profile$/);

    await expect(page.getByRole('heading', { level: 1, name: ownerUser.fullName })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Owner', { exact: true })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Insights' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My properties' })).toBeVisible();

    await expect(page.getByText('Saved')).toBeVisible();
    await expect(page.getByText('Member since')).toBeVisible();
  });

  test('owner insights link navigates to /insights', async ({ page, ownerUser }) => {
    await loginAsTestUser(page, ownerUser.phone);
    await goto(page, '/profile');
    await page.getByRole('link', { name: 'Insights' }).click();
    await expect(page).toHaveURL(/\/insights$/);
  });

  test('owner my-properties link navigates to /my-properties', async ({ page, ownerUser }) => {
    await loginAsTestUser(page, ownerUser.phone);
    await goto(page, '/profile');
    await page.getByRole('link', { name: 'My properties' }).click();
    await expect(page).toHaveURL(/\/my-properties$/);
  });
});

test.describe('Profile page — BROWSER view', () => {
  test('browser user does NOT see Insights or My Properties links', async ({
    page,
    browserUser,
  }) => {
    await loginAsTestUser(page, browserUser.phone);
    await goto(page, '/profile');
    await expect(page).toHaveURL(/\/profile$/);

    await expect(page.getByRole('heading', { level: 1, name: browserUser.fullName })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Browser', { exact: true })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Insights' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'My properties' })).not.toBeVisible();

    await expect(page.getByText('Saved')).toBeVisible();
    await expect(page.getByText('Member since')).toBeVisible();
  });
});
