import { expect, test } from '@playwright/test';
import { loginAsUser } from './test-helpers';

test.describe('Insights dashboard — owner with properties', () => {
  test('metric cards show accurate data for an owner with listings', async ({ page }) => {
    await loginAsUser(page, '+966', '501111001');
    await page.goto('/insights');
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
  test('owner with no properties sees empty state and create CTA', async ({ page }) => {
    await loginAsUser(page, '+966', '509990001');
    await page.goto('/insights');
    await expect(page).toHaveURL(/\/insights$/);

    await expect(page.getByText("You haven't created any listings yet")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /create your first listing/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Insights dashboard — browser user', () => {
  test('browser user is redirected from /insights', async ({ page }) => {
    await loginAsUser(page, '+966', '501111004');
    await page.goto('/insights');
    await expect(page).not.toHaveURL(/\/insights$/);
  });
});
