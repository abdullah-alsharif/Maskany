/**
 * E2E — Cross-cutting edge cases.
 *
 * Scenarios that don't fit a single feature spec but protect against
 * regression: state persistence, idempotent interactions, session
 * rejection, account lifecycle round-trips, and unauthenticated API
 * behavior. Every test is fully isolated via the fixtures layer.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser, submitOtpFromDb, dismissRecoveryPrompt } from './test-helpers';
import { deleteTestUserByPhone } from './test-data';

test.setTimeout(90_000);

test.describe('Guest state edge cases', () => {
  test('guest favorites survive a full page reload', async ({ page, seedProperties }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const expectedTitle = seedProperties[0].title;
    const firstCard = grid.locator('article').filter({ hasText: expectedTitle });

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

    const firstCard = page.getByTestId('property-grid').locator('article').first();
    const detailHref = await firstCard
      .getByRole('link', { name: /View details for/ })
      .getAttribute('href');
    const propertyId = detailHref!.split('/').pop();
    const addButton = firstCard.getByRole('button', { name: 'Add to favorites' });

    // Fire two clicks back-to-back without waiting for the first to settle.
    // Target the heart in whatever state it is in (add or remove) with a
    // short action timeout, so the second click never blocks on a button
    // that has already re-rendered to the opposite state.
    await addButton.click();
    await firstCard
      .getByRole('button', { name: /favorites/i })
      .click({ force: true, timeout: 3_000 })
      .catch(() => {});

    // Authenticated favorites live on the server (the guest localStorage
    // key `maskany_favorites` is not used). Whatever the outcome of the
    // double click (added once, or added-then-removed), the invariant is
    // that the server never stores the property more than once.
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

    // The app must reject the invalid session: either it redirects to
    // /login, or the profile renders the unauthenticated sign-in CTA.
    await expect
      .poll(
        async () => {
          const url = page.url();
          if (url.endsWith('/login')) return true;
          const signIn = page.getByRole('link', { name: 'Sign in' });
          return (await signIn.count()) > 0 && (await signIn.isVisible());
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  });

  test('newly registered account can log out and log back in', async ({ page, uniqueData }) => {
    const fullName = `${uniqueData.fullName} Roundtrip`;
    const fullPhone = uniqueData.phone;

    // The uniqueData phone is deterministic per test id, so a Playwright
    // retry re-runs this exact block with the same phone. Delete any
    // leftover user from a prior attempt first (the end-of-test cleanup
    // never runs when a test fails midway), keeping the retry idempotent.
    await deleteTestUserByPhone(fullPhone);

    // --- Register via the UI ---
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

    // --- Log out ---
    await goto(page, '/profile');
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

    // --- Log back in with the same phone ---
    // The dev server can remount/reload the page mid-flow under parallel
    // compile (dropping the OTP navigation state), so the whole "login →
    // verify → home" sequence is retried as a unit until it lands. Each
    // attempt re-sends a fresh code, re-types it, and waits for home.
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

    // --- Clean up ---
    await deleteTestUserByPhone(fullPhone);
  });
});

test.describe('API edge cases', () => {
  test('protected endpoint returns 401 without a token', async ({ page }) => {
    const response = await page.request.get('http://localhost:3099/api/properties/my');
    expect(response.status()).toBe(401);
  });
});
