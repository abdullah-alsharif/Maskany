/**
 * E2E — Status toggle (US9): deactivation and reactivation are separate
 * tests, each seeded through the test-data layer (active fixture property /
 * inactive DB row) so the behavior under test is a single state flip.
 * Fixture teardown cascades the property away — no inline delete step.
 */
import { expect, test } from './test-fixtures';
import { goto, loginAsTestUser } from './test-helpers';
import { createTestProperty } from './test-data';
import { MyPropertiesPage } from './pages/my-properties-page';

test.describe('Status toggle', () => {
  test('deactivating a property hides it from the public listing', async ({
    page,
    ownerWithProperty,
  }) => {
    const { owner, property } = ownerWithProperty;

    await loginAsTestUser(page, owner.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    // Precondition: the active property answers an exact-title search BEFORE
    // deactivation — without it the absence poll below could pass vacuously.
    await page.getByLabel('Search properties').fill(property.title);
    await expect(
      page.getByTestId('property-grid').getByRole('article').filter({ hasText: property.title }),
    ).toBeVisible({ timeout: 15_000 });

    const myProperties = new MyPropertiesPage(page);
    await myProperties.goto();
    const testCard = myProperties.card(property.title);
    await expect(testCard.getByText('Active', { exact: true })).toBeVisible({ timeout: 10_000 });

    await myProperties.toggleStatus(property.title, 'Inactive');

    // The property must NOT answer that exact public search: title scoping
    // resists parallel inserts (page-1 push-off) and unrelated-grid masking.
    await goto(page, '/');
    await page.getByLabel('Search properties').fill(property.title);
    await expect
      .poll(
        async () =>
          page
            .getByTestId('property-grid')
            .getByRole('article')
            .filter({ hasText: property.title })
            .count(),
        { timeout: 15_000 },
      )
      .toBe(0);
  });

  test('reactivating a property brings it back to the public listing', async ({
    page,
    ownerUser,
    uniqueData,
  }) => {
    const property = await createTestProperty({
      ownerId: ownerUser.id,
      title: uniqueData.title('Reactivate Property'),
      status: 'INACTIVE',
    });

    await loginAsTestUser(page, ownerUser.phone);
    await expect(page.getByTestId('property-grid')).toBeVisible({ timeout: 15_000 });

    const myProperties = new MyPropertiesPage(page);
    await myProperties.goto();
    const testCard = myProperties.card(property.title);
    await expect(testCard.getByText('Inactive', { exact: true })).toBeVisible({ timeout: 10_000 });

    await myProperties.toggleStatus(property.title, 'Active');

    // Exact-title search returns the best title match despite parallel
    // workers' inserts — no "newest row stays on page 1" assumption.
    await goto(page, '/');
    await page.getByLabel('Search properties').fill(property.title);
    await expect(
      page.getByTestId('property-grid').getByRole('article').filter({ hasText: property.title }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
