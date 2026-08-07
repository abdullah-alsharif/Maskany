/**
 * E2E — Cross-cutting edge cases.
 *
 * Regression guards that fit no single spec: persistence, idempotency,
 * session rejection, account round-trips, and unauthenticated API behavior.
 * Every test is fully isolated via the fixtures layer.
 */
import { expect, test } from './test-fixtures';
import {
  goto,
  loginAsTestUser,
  submitOtpFromDb,
  dismissRecoveryPrompt,
  TEST_API_URL,
} from './test-helpers';
import { deleteTestUserByPhone } from './test-data';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.setTimeout(90_000);

test.describe('Guest state edge cases', () => {
  test('guest favorites survive a full page reload', async ({ page, seedProperties }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const expectedTitle = seedProperties[0].title;
    const firstCard = grid.getByRole('article').filter({ hasText: expectedTitle });

    await firstCard.getByRole('button', { name: 'Add to favorites' }).click();
    await expect(firstCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);
    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();
  });

  test('rapid double-click on the heart never duplicates the favorite', async ({
    page,
    browserUser,
  }) => {
    await loginAsTestUser(page, browserUser.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    // Seeded card — fixture-created ones may be deleted mid-run by a
    // parallel suite, and the property must survive the whole run.
    const firstCard = page
      .getByTestId('property-grid')
      .getByRole('article')
      .filter({ hasText: SEED_PROPERTY_TITLES[0] });
    const detailHref = await firstCard
      .getByRole('link', { name: /View details for/ })
      .getAttribute('href');
    const propertyId = detailHref!.split('/').pop();
    const addButton = firstCard.getByRole('button', { name: 'Add to favorites' });

    // Back-to-back clicks; the second targets whatever state the heart is in
    // (short timeout). Only timeouts are tolerated — real errors must fail.
    await addButton.click();
    await firstCard
      .getByRole('button', { name: /favorites/i })
      .click({ force: true, timeout: 3_000 })
      .catch((err: Error) => {
        if (!String(err).includes('Timeout')) throw err;
      });

    // Authenticated favorites live server-side (the localStorage key is
    // unused); the invariant is the server never stores the property twice.
    await expect
      .poll(
        async () =>
          page.evaluate(async (id) => {
            const token = window.localStorage.getItem('maskany:accessToken');
            if (!token) return false;
            const res = await window.fetch('/api/favorites', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return false;
            const body = (await res.json()) as { favorites: Array<{ propertyId: string }> };
            const count = (body.favorites ?? []).filter((f) => f.propertyId === id).length;
            return count <= 1;
          }, propertyId),
        { timeout: 10_000 },
      )
      .toBe(true);

    // The heart must be in one of the two consistent states.
    const removeButton = firstCard.getByRole('button', { name: 'Remove from favorites' });
    const reAddButton = firstCard.getByRole('button', { name: 'Add to favorites' });
    await expect
      .poll(async () => (await removeButton.isVisible()) || (await reAddButton.isVisible()), {
        timeout: 10_000,
      })
      .toBe(true);
  });
});

test.describe('Session edge cases', () => {
  test('bogus stored session is rejected and the user is logged out', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('maskany:accessToken', 'bogus-access-token');
      localStorage.setItem('maskany:refreshToken', 'bogus-refresh-token');
      localStorage.setItem(
        'maskany:user',
        JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          fullName: 'Ghost Session',
          phone: '+9665000000000',
          userType: 'BROWSER',
        }),
      );
    });

    await goto(page, '/profile');

    // Hydration fails against the API, so the profile shows the sign-in
    // CTA and no authenticated content may appear.
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Log out' })).not.toBeVisible();
  });

  test('newly registered account can log out and log back in', async ({ page, uniqueData }) => {
    const fullName = `${uniqueData.fullName} Roundtrip`;
    const fullPhone = uniqueData.phone;

    // The phone is deterministic per test id, so a retry re-runs this exact
    // block; delete leftovers since a failed run skips the cleanup.
    await deleteTestUserByPhone(fullPhone);

    await goto(page, '/register');
    await page.getByLabel('Full name').fill(fullName);
    await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
    await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
    await page.getByLabel('Email (optional)').fill(uniqueData.email);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);
    await submitOtpFromDb(page, fullPhone);
    await dismissRecoveryPrompt(page);
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await goto(page, '/profile');
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

    // Dev server can remount/reload the page under parallel compile (dropping
    // OTP navigation state), so retry login → verify → home as a unit.
    await expect(async () => {
      await goto(page, '/login');
      await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
      await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
      await page.getByRole('button', { name: 'Send code' }).click();
      await page.waitForURL(/\/verify-otp$/, { timeout: 15_000 });
      await submitOtpFromDb(page, fullPhone);
      await dismissRecoveryPrompt(page);
      await page.waitForURL(/\/$/, { timeout: 15_000 });
    }).toPass({ timeout: 90_000 });

    await goto(page, '/profile');
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 });

    await deleteTestUserByPhone(fullPhone);
  });
});

test.describe('API edge cases', () => {
  test('protected endpoint returns 401 without a token', async ({ page }) => {
    const response = await page.request.get(`${TEST_API_URL}/properties/my`);
    expect(response.status()).toBe(401);
  });
});
