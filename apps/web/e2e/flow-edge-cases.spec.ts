/**
 * E2E — Flow edge cases.
 *
 * Route guards and role-based redirects for guests, browsers and owners.
 * Every authenticated scenario uses a fresh per-test user.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser, TEST_API_URL } from './test-helpers';

test.describe('Flow edge cases', () => {
  test('guest visiting /favorites renders page without redirect', async ({ page }) => {
    await goto(page, '/favorites');
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('owner can reach /my-properties after logging in', async ({ page, ownerUser }) => {
    await goto(page, '/my-properties');
    await expect(page).toHaveURL(/\/login$/);

    await loginAsTestUser(page, ownerUser.phone);
    await goto(page, '/my-properties');
    await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('browser user visiting /insights is redirected to home', async ({ page, browserUser }) => {
    await loginAsTestUser(page, browserUser.phone);
    await goto(page, '/insights');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });

  test('browser user visiting /my-properties is redirected to home', async ({
    page,
    browserUser,
  }) => {
    await loginAsTestUser(page, browserUser.phone);
    await goto(page, '/my-properties');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });

  test('guest visiting a protected API route gets an auth error', async ({ page }) => {
    const response = await page.request.get(`${TEST_API_URL}/auth/me`);
    expect(response.status()).toBe(401);
  });
});
