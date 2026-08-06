import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.describe('Similar properties', () => {
  test('property detail page shows similar properties section', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await grid
      .locator('article')
      .filter({ hasText: SEED_PROPERTY_TITLES[0] })
      .locator('a')
      .first()
      .click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);

    const similarSection = page.getByRole('heading', { name: /similar properties/i });
    await expect(similarSection).toBeVisible({ timeout: 10_000 });

    const similarCards = page.locator('[data-testid="similar-properties"] a');
    const cardCount = await similarCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < cardCount; i++) {
      await expect(similarCards.nth(i).locator('h3')).toBeVisible();
    }
  });

  test('clicking a similar property navigates to its detail page', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    await grid
      .locator('article')
      .filter({ hasText: SEED_PROPERTY_TITLES[0] })
      .locator('a')
      .first()
      .click();
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
    const propertyUrl = page.url();

    const similarSection = page.getByRole('heading', { name: /similar properties/i });
    await expect(similarSection).toBeVisible({ timeout: 10_000 });

    const similarCards = page.locator('[data-testid="similar-properties"] a');
    const cardCount = await similarCards.count();
    if (cardCount > 0) {
      const similarLink = similarCards.first();
      await similarLink.click();
      await page.waitForURL(
        (url) => /\/properties\/[0-9a-f-]{36}$/.test(url.href) && url.href !== propertyUrl,
      );
    }
  });
});
