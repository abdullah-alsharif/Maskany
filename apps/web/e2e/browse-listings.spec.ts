/**
 * E2E — Browse listings (T-033, PRD §3.5, §4.1).
 *
 * The home page must load with at least one property card visible, and
 * tapping a card must take the user to that property's detail page where
 * its title is rendered as the primary heading.
 */
import { expect, test } from '@playwright/test';

test.describe('Browse listings', () => {
  test('home page loads with property cards and a card click navigates to detail', async ({
    page,
  }) => {
    await page.goto('/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const firstCard = grid.locator('article').first();
    await expect(firstCard).toBeVisible();

    const titleLocator = firstCard.locator('h3');
    const expectedTitle = (await titleLocator.innerText()).trim();
    expect(expectedTitle.length).toBeGreaterThan(0);

    await firstCard.locator('a').first().click();

    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    const detailHeading = page.getByRole('heading', { level: 1, name: expectedTitle });
    await expect(detailHeading).toBeVisible({ timeout: 15_000 });
  });
});
