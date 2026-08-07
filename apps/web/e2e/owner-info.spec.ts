/**
 * E2E — Owner info on detail page (US8): validates owner name and
 * member-since date per PRD §3.4.
 */
import { goto, openSeedProperty } from './test-helpers';
import { expect, test } from '@playwright/test';
import { SEED_PROPERTY_TITLES } from './test-fixtures';

test.describe('Owner Info', () => {
  test('property detail shows owner name', async ({ page }) => {
    await goto(page, '/');

    // Seeded card — never deleted mid-run.
    await openSeedProperty(page, SEED_PROPERTY_TITLES[0]);

    await expect(page.getByText('About the owner')).toBeVisible({ timeout: 10_000 });

    // SEED_PROPERTY_TITLES[0] is owned by the seeded owner-layla user,
    // so the exact name string is deterministic.
    await expect(page.getByText('Layla Al-Mansouri', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('property detail shows member since date', async ({ page }) => {
    await goto(page, '/');
    await openSeedProperty(page, SEED_PROPERTY_TITLES[0]);

    await expect(page.getByText(/member since/i)).toBeVisible({ timeout: 10_000 });
  });
});
