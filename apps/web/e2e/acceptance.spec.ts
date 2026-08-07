/**
 * E2E — AC-42: Complete acceptance workflow (E2E smoke test).
 *
 * One test per user journey (PRD §3-§5 + §7). Each journey owns its data
 * through the fixtures/cleanup layer, keeping the suite parallel-safe and
 * ensuring a mid-flight failure never leaks state.
 */
import { expect, test, SEED_PROPERTY_TITLES } from './test-fixtures';
import {
  goto,
  openSeedProperty,
  submitOtpFromDb,
  dismissRecoveryPrompt,
  loginAsTestUser,
} from './test-helpers';
import { deleteTestUserByPhone } from './test-data';
import { PropertyWizardPage } from './pages/property-wizard-page';

const REVIEW_COMMENT = 'Great property, very satisfied!';

test.describe('[AC-42] Acceptance journeys', () => {
  test('guest searches and clears the home grid', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Search may route through semantic search, so anchor on the API
    // round-trip and the seed apartment card rather than every card's text.
    const searchResponse = page.waitForResponse(
      (res) => res.url().includes('/api/properties') && res.url().includes('q='),
    );
    await page.getByLabel('Search properties').fill('apartment');
    expect((await searchResponse).status()).toBe(200);
    await expect(page.getByText(SEED_PROPERTY_TITLES[0], { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Home grid is always a full page (24+ seeded props, fixtures only add),
    // so assert that invariant — a baseline count could race fixture deletes.
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect
      .poll(async () => grid.getByRole('article').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(20);
  });

  test('guest opens a seeded property detail with its WhatsApp deep link', async ({ page }) => {
    await goto(page, '/');

    // Seeded property — never deleted mid-run, deterministic anchor.
    await openSeedProperty(page, SEED_PROPERTY_TITLES[0]);
    await expect(
      page.getByRole('heading', { level: 1, name: SEED_PROPERTY_TITLES[0] }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Property specifications')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Amenities' })).toBeVisible();

    const waLink = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(waLink).toBeVisible({ timeout: 10_000 });
    await expect(waLink).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{7,15}\?text=/);
  });

  test('browser user registers, favorites a listing, and logs out', async ({
    page,
    uniqueData,
  }) => {
    const fullName = `${uniqueData.fullName} Browser`;
    const fullPhone = uniqueData.phone;

    try {
      // The phone derives from the test id, so a retry re-runs this exact
      // block with the same number — delete leftovers up front.
      await deleteTestUserByPhone(fullPhone);

      // Register via the UI (default account type is BROWSER).
      await goto(page, '/profile');
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
      await page.getByRole('link', { name: 'Sign in' }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.getByRole('link', { name: 'Create account' }).click();
      await expect(page).toHaveURL(/\/register$/);
      await page.getByLabel('Full name').fill(fullName);
      await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
      await page.getByLabel('Phone number').fill(uniqueData.phoneLocal);
      await page.getByLabel('Email (optional)').fill(uniqueData.email);
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page).toHaveURL(/\/verify-otp$/);
      await submitOtpFromDb(page, fullPhone);
      await dismissRecoveryPrompt(page);
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

      const grid = page.getByTestId('property-grid');
      await expect(grid).toBeVisible({ timeout: 15_000 });
      const seedCard = grid.getByRole('article').filter({ hasText: SEED_PROPERTY_TITLES[0] });
      await seedCard.getByRole('button', { name: 'Add to favorites' }).click();
      await expect(seedCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible({
        timeout: 10_000,
      });

      await page.getByRole('link', { name: 'Favorites' }).click();
      await expect(page).toHaveURL(/\/favorites$/);
      const favoritesGrid = page.getByTestId('favorites-grid');
      await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
      await expect(favoritesGrid.getByText(SEED_PROPERTY_TITLES[0], { exact: true })).toBeVisible();

      await page.getByRole('link', { name: 'Profile' }).click();
      await expect(page).toHaveURL(/\/profile$/);
      await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(fullPhone)).toBeVisible();

      await page.getByRole('button', { name: 'Log out' }).click();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    } finally {
      // Clean up the account so the next run starts from the baseline seed.
      await deleteTestUserByPhone(fullPhone);
    }
  });

  test('owner registers, creates and edits a listing, and cannot review it', async ({
    page,
    uniqueData,
  }) => {
    test.setTimeout(120_000);

    const fullName = `${uniqueData.fullName} Owner`;
    const phoneLocal = `51${uniqueData.suffix}`;
    const fullPhone = `+966${phoneLocal}`;
    const email = `owner-${uniqueData.suffix}@test.example.com`;
    const propertyTitle = `E2E Acceptance Test Property ${uniqueData.suffix}`;
    const editedTitle = `${propertyTitle} (Updated)`;

    try {
      await deleteTestUserByPhone(fullPhone);

      await goto(page, '/profile');
      await page.getByRole('link', { name: 'Sign in' }).click();
      await page.getByRole('link', { name: 'Create account' }).click();
      await expect(page).toHaveURL(/\/register$/);
      await page.getByLabel('Full name').fill(fullName);
      await page.getByLabel('Country code').selectOption(uniqueData.countryCode);
      await page.getByLabel('Phone number').fill(phoneLocal);
      await page.getByLabel('Email (optional)').fill(email);
      await page.getByRole('radio', { name: /owner/i }).click();
      await page.getByRole('button', { name: 'Create account' }).click();
      await expect(page).toHaveURL(/\/verify-otp$/);
      await submitOtpFromDb(page, fullPhone);
      await dismissRecoveryPrompt(page);
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

      const wizard = new PropertyWizardPage(page);
      await wizard.gotoCreate();
      await wizard.fillBasics(propertyTitle, 'A test property created during acceptance E2E.');
      await wizard.fillDetails({
        price: '5000',
        bedrooms: '2',
        bathrooms: '1',
        area: '80',
        currency: 'SAR',
      });
      await wizard.fillLocation({ city: 'Riyadh', neighborhood: 'Al Olaya', country: 'SA' });
      await wizard.skipImages();
      await wizard.fillContact(fullPhone);
      await wizard.publish();
      await expect(page.getByRole('heading', { level: 1, name: propertyTitle })).toBeVisible({
        timeout: 15_000,
      });

      // Edit the title through the wizard.
      await goto(page, '/my-properties');
      await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole('link', { name: `Edit ${propertyTitle}` }).click();
      await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}\/edit$/);
      await page.getByLabel('Title').clear();
      await page.getByLabel('Title').fill(editedTitle);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 2 of 6')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 3 of 6')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 4 of 6')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 5 of 6')).toBeVisible({ timeout: 5_000 });
      const waInput = page.getByLabel('WhatsApp number');
      await waInput.clear();
      await waInput.fill(fullPhone);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 6 of 6')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Publish changes' }).click();
      await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1, name: editedTitle })).toBeVisible({
        timeout: 10_000,
      });

      await expect(page.getByText(/owners cannot review their own property/i)).toBeVisible({
        timeout: 10_000,
      });

      await goto(page, '/my-properties');
      await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole('button', { name: `Delete ${editedTitle}` }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Yes, delete listing' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    } finally {
      // Cascade-deletes the property as well.
      await deleteTestUserByPhone(fullPhone);
    }
  });

  test('a registered browser user reviews the owner listing', async ({
    page,
    browserUser,
    ownerWithProperty,
  }) => {
    const { property } = ownerWithProperty;

    await loginAsTestUser(page, browserUser.phone);
    await goto(page, `/properties/${property.id}`);
    await expect(page.getByRole('heading', { level: 1, name: property.title })).toBeVisible({
      timeout: 15_000,
    });

    const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewsSection.scrollIntoViewIfNeeded();
    await expect(reviewsSection).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Rate 5 stars' }).click();
    await page.getByLabel('Comment').fill(REVIEW_COMMENT);
    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByText(REVIEW_COMMENT)).toBeVisible({ timeout: 10_000 });
  });

  test('category tabs filter the grid', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Card and badge counts are read in the same poll callback so the
    // equality never observes a half-updated DOM during the refetch.
    await page.getByRole('tab', { name: 'Villas' }).click();
    const filteredGrid = grid.getByRole('article');
    await expect
      .poll(
        async () => {
          const count = await filteredGrid.count();
          if (count === 0) return false;
          const villas = await filteredGrid.getByText(/^Villa$/).count();
          return villas === count;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('language toggle switches locale and back', async ({ page }) => {
    await goto(page, '/');

    await page.getByRole('button', { name: 'التبديل إلى العربية' }).click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.getByRole('button', { name: 'التبديل إلى العربية' })).toBeVisible();
  });
});
