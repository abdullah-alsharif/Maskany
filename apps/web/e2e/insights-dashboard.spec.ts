/**
 * E2E — Insights dashboard (owner analytics).
 *
 * Fresh per-test users keep metric assertions exact and parallel-safe:
 * the owner sees exactly the fixture property and the empty case has none.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';

test.describe('Insights dashboard — owner with properties', () => {
  test('metric cards show exact data for an owner with one active listing', async ({
    page,
    ownerWithProperty,
  }) => {
    await loginAsTestUser(page, ownerWithProperty.owner.phone);
    await goto(page, '/insights');
    await expect(page).toHaveURL(/\/insights$/);

    // Metric cards are scoped by stable testid — labels are localized, testids are not.
    const listingsCard = page.getByTestId('metric-total-listings');
    await expect(listingsCard).toBeVisible({ timeout: 15_000 });
    await expect(listingsCard.getByText('1', { exact: true })).toBeVisible();

    const activeCard = page.getByTestId('metric-active-listings');
    await expect(activeCard).toBeVisible({ timeout: 5_000 });
    await expect(activeCard.getByText('1', { exact: true })).toBeVisible();

    const viewsCard = page.getByTestId('metric-total-views');
    await expect(viewsCard).toBeVisible({ timeout: 10_000 });
    await expect(viewsCard.getByText('0', { exact: true })).toBeVisible();

    const inquiriesCard = page.getByTestId('metric-inquiries');
    await expect(inquiriesCard).toBeVisible({ timeout: 10_000 });
    await expect(inquiriesCard.getByText('0', { exact: true })).toBeVisible();

    await expect(page.getByText(ownerWithProperty.property.title)).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText('Top Properties')).toBeVisible();
    await expect(page.getByText('Best performing listings')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Insights dashboard — empty state', () => {
  test('owner with no properties sees empty state and create CTA', async ({ page, ownerUser }) => {
    await loginAsTestUser(page, ownerUser.phone);
    await goto(page, '/insights');
    await expect(page).toHaveURL(/\/insights$/);

    await expect(page.getByText("You haven't created any listings yet")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /create your first listing/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Insights dashboard — browser user', () => {
  test('browser user is redirected from /insights to home', async ({ page, browserUser }) => {
    await loginAsTestUser(page, browserUser.phone);
    await goto(page, '/insights');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });
});
