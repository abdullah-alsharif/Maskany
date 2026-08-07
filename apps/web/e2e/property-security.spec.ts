/**
 * E2E — Property security and access control. Every scenario runs as a
 * fresh per-test user, so parallel runs never share sessions or OTP
 * cooldowns. (Empty-title validation lives in property-form-validation.spec.ts.)
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';

test.describe('Self-review block', () => {
  test('owner visiting their own property sees they cannot review it', async ({
    page,
    ownerWithProperty,
  }) => {
    const { property } = ownerWithProperty;
    await loginAsTestUser(page, ownerWithProperty.owner.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    await goto(page, `/properties/${property.id}`);
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText(/owners cannot review their own property/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByRole('button', { name: /submit review/i })).not.toBeVisible();
  });
});

test.describe('Browser user restrictions', () => {
  test('browser-type user cannot access create-property page', async ({ page, browserUser }) => {
    await loginAsTestUser(page, browserUser.phone);

    await goto(page, '/properties/create');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });
});
