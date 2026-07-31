import { expect, test } from '@playwright/test';
import { loginAsUser } from './test-helpers';

test.describe('Profile page — OWNER view', () => {
  test('owner sees Insights and My Properties links', async ({ page }) => {
    await loginAsUser(page, '+966', '501111001');
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile$/);

    await expect(page.getByRole('heading', { level: 1, name: 'Layla Al-Mansouri' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('OWNER')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Insights' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My properties' })).toBeVisible();

    await expect(page.getByText('Saved')).toBeVisible();
    await expect(page.getByText('Member since')).toBeVisible();
  });

  test('owner insights link navigates to /insights', async ({ page }) => {
    await loginAsUser(page, '+966', '501111001');
    await page.goto('/profile');
    await page.getByRole('link', { name: 'Insights' }).click();
    await expect(page).toHaveURL(/\/insights$/);
  });

  test('owner my-properties link navigates to /my-properties', async ({ page }) => {
    await loginAsUser(page, '+966', '501111001');
    await page.goto('/profile');
    await page.getByRole('link', { name: 'My properties' }).click();
    await expect(page).toHaveURL(/\/my-properties$/);
  });
});

test.describe('Profile page — BROWSER view', () => {
  test('browser user does NOT see Insights or My Properties links', async ({ page }) => {
    await loginAsUser(page, '+966', '501111004');
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile$/);

    await expect(page.getByRole('heading', { level: 1, name: 'Khalid Rahman' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('BROWSER')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Insights' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'My properties' })).not.toBeVisible();

    await expect(page.getByText('Saved')).toBeVisible();
    await expect(page.getByText('Member since')).toBeVisible();
  });
});
