import { goto, openSeedProperty } from './test-helpers';
import { expect, test } from '@playwright/test';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.describe('Similar properties', () => {
  test('property detail page shows similar properties section', async ({ page }) => {
    await goto(page, '/');
    await openSeedProperty(page, SEED_PROPERTY_TITLES[0]);

    const similarSection = page.getByTestId('similar-properties');
    await expect(similarSection).toBeVisible({ timeout: 10_000 });

    const similarCards = page.getByTestId('similar-properties').getByRole('link');
    const cardCount = await similarCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Sample the first card — all render from the same component, so
    // per-index iteration adds noise without new signal.
    await expect(similarCards.first().getByRole('heading', { level: 3 })).toBeVisible();
  });

  test('clicking a similar property navigates to its detail page', async ({ page }) => {
    await goto(page, '/');
    const propertyUrl = await openSeedProperty(page, SEED_PROPERTY_TITLES[0]);

    const similarSection = page.getByTestId('similar-properties');
    await expect(similarSection).toBeVisible({ timeout: 10_000 });

    const similarCards = page.getByTestId('similar-properties').getByRole('link');
    const cardCount = await similarCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    const similarLink = similarCards.first();
    await similarLink.click();
    await page.waitForURL(
      (url) => /\/properties\/[0-9a-f-]{36}$/.test(url.href) && url.href !== propertyUrl,
    );
  });
});
