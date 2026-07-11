/**
 * E2E — Owner info on detail page (US8).
 *
 * Validates that property detail pages display owner name and
 * member-since date as required by PRD §3.4.
 */
import { expect, test } from '@playwright/test';

test.describe('Owner Info', () => {
  test('property detail shows owner name', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Click the first property card.
    const firstCard = grid.locator('article').first();
    await firstCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    // Owner section should be visible.
    await expect(page.getByText('About the owner')).toBeVisible({ timeout: 10_000 });

    // Owner name should be visible (seeded owners: Layla, Omar, Sara).
    const ownerSection = page.locator('section').filter({ hasText: 'About the owner' });
    const ownerName = ownerSection.locator('p').first();
    const nameText = await ownerName.innerText();
    expect(nameText.length).toBeGreaterThan(0);
  });

  test('property detail shows member since date', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    await firstCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    // "Member since" text should be visible.
    await expect(page.getByText(/member since/i)).toBeVisible({ timeout: 10_000 });
  });
});
