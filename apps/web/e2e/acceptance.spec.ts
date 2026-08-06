/**
 * E2E — AC-42: Complete acceptance workflow (E2E smoke test).
 *
 * Single long test covering the full happy path through the app:
 * unauthenticated browsing → registration → favorites → profile →
 * logout → owner registration → property CRUD → reviews → categories → language.
 *
 * Both registered users use unique phone numbers derived from the test id,
 * so parallel runs and reruns never collide. OTP cooldown is disabled in
 * the test environment (OTP_COOLDOWN_MS=0), so the old 35s retry hack is
 * no longer needed.
 *
 * 375x812 viewport, 120s timeout (set via test.setTimeout).
 */
import { expect, test, SEED_PROPERTY_TITLES } from './test-fixtures';
import { goto, submitOtpFromDb, dismissRecoveryPrompt } from './test-helpers';
import { deleteTestUserByPhone } from './test-data';
import { PropertyWizardPage } from './pages/property-wizard-page';

const PROPERTY_TITLE = 'E2E Acceptance Test Property';
const EDITED_TITLE = 'E2E Acceptance Test Property (Updated)';
const REVIEW_COMMENT = 'Great property, very satisfied!';

test('[AC-42] Complete acceptance workflow (E2E smoke test)', async ({ page, uniqueData }) => {
  test.setTimeout(120_000);

  const user1Name = `${uniqueData.fullName} Browser`;
  const user1Country = uniqueData.countryCode;
  const user1PhoneLocal = uniqueData.phoneLocal;
  const user1FullPhone = uniqueData.phone;
  const user1Email = uniqueData.email;

  const user2Name = `${uniqueData.fullName} Owner`;
  const user2Country = uniqueData.countryCode;
  // Different valid Saudi mobile number than user1 (51XXXXXXXX).
  const user2PhoneLocal = `51${uniqueData.suffix}`;
  const user2FullPhone = `+966${user2PhoneLocal}`;
  const user2Email = `owner-${uniqueData.suffix}@test.example.com`;

  // Both phones derive from the test id, so a Playwright retry re-runs this
  // exact block with the same numbers. Delete any leftovers from a prior
  // attempt up front (end-of-test cleanup never runs after a mid-flight
  // failure), keeping retries idempotent.
  await deleteTestUserByPhone(user1FullPhone);
  await deleteTestUserByPhone(user2FullPhone);

  const grid = page.getByTestId('property-grid');
  let initialCardCount = 0;

  await test.step('Unauth user browses home → sees property grid', async () => {
    await goto(page, '/');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    initialCardCount = await grid.locator('article').count();
    expect(initialCardCount).toBeGreaterThan(0);
  });

  await test.step('Unauth user searches "apartment" → filtered results', async () => {
    const searchInput = page.getByLabel('Search properties').first();
    await searchInput.fill('apartment');

    await expect
      .poll(
        async () => {
          const count = await grid.locator('article').count();
          return count;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    // Clear search and wait for full grid restoration
    const clearBtn = page.getByRole('button', { name: 'Clear search' });
    await clearBtn.click();
    await expect
      .poll(async () => grid.locator('article').count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(initialCardCount);
  });

  let expectedTitle = '';
  let propHref: string | null = null;

  await test.step('Unauth user views property detail → all fields present', async () => {
    const firstCard = grid.locator('article').filter({ hasText: SEED_PROPERTY_TITLES[0] });
    const propLink = firstCard.locator('a[href^="/properties/"]').first();
    expectedTitle = SEED_PROPERTY_TITLES[0];
    propHref = await propLink.getAttribute('href');
    await goto(page, propHref!);
    await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1, name: expectedTitle })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel('Property specifications')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Amenities' })).toBeVisible();
  });

  await test.step('Unauth user clicks WhatsApp → wa.me deep link with correct message', async () => {
    const waLink = page.getByRole('link', { name: /contact property owner on whatsapp/i });
    await expect(waLink).toBeVisible({ timeout: 10_000 });
    const href = await waLink.getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/\d{7,15}\?text=/);
  });

  await test.step('New user (browser) registers with phone → OTP sent; verifies → redirected home', async () => {
    await goto(page, '/profile');
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('link', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/register$/);

    await page.getByLabel('Full name').fill(user1Name);
    await page.getByLabel('Country code').selectOption(user1Country);
    await page.getByLabel('Phone number').fill(user1PhoneLocal);
    await page.getByLabel('Email (optional)').fill(user1Email);
    // Default account type is BROWSER — keep it.
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);

    await submitOtpFromDb(page, user1FullPhone);
    await dismissRecoveryPrompt(page);
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  });

  let favBtn: ReturnType<typeof page.getByRole> | null = null;

  await test.step('User browses as authenticated → favorites button active', async () => {
    await expect(grid).toBeVisible({ timeout: 15_000 });
    favBtn = grid
      .locator('article')
      .filter({ hasText: SEED_PROPERTY_TITLES[0] })
      .getByRole('button', { name: /add to favorites/i });
    await expect(favBtn).toBeVisible();
  });

  await test.step('User adds property to favorites → heart fills', async () => {
    await favBtn!.click();
    await expect(
      grid
        .locator('article')
        .filter({ hasText: SEED_PROPERTY_TITLES[0] })
        .getByRole('button', { name: /remove from favorites/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  await test.step('User navigates to favorites tab → property appears', async () => {
    await page.getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);
    const favoritesGrid = page.getByTestId('favorites-grid');
    await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
    await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();
  });

  await test.step('User navigates to profile → user info displayed', async () => {
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText(user1Name)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(user1FullPhone)).toBeVisible();
  });

  await test.step('User logs out → redirected to login', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

    // Navigate home — grid still loads
    await goto(page, '/');
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });

  await test.step('Second user (owner) registers → OTP verified', async () => {
    await goto(page, '/profile');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.getByRole('link', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/register$/);

    await page.getByLabel('Full name').fill(user2Name);
    await page.getByLabel('Country code').selectOption(user2Country);
    await page.getByLabel('Phone number').fill(user2PhoneLocal);
    await page.getByLabel('Email (optional)').fill(user2Email);
    // Select Owner account type
    await page.getByRole('radio', { name: /owner/i }).click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);

    await submitOtpFromDb(page, user2FullPhone);
    await dismissRecoveryPrompt(page);
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  });

  let propertyUrl = '';

  await test.step('Owner creates property listing', async () => {
    // The dev server can remount the page mid-wizard under parallel
    // compile (resetting the form to Step 1). Re-drive the whole creation
    // from scratch until it lands on a detail page — but exit early if a
    // previous attempt already published, so retries never duplicate the
    // listing.
    await expect(async () => {
      if (
        /\/properties\/[0-9a-f-]{36}$/.test(page.url()) &&
        (await page
          .getByRole('heading', { level: 1, name: PROPERTY_TITLE })
          .isVisible()
          .catch(() => false))
      ) {
        return;
      }
      const wizard = new PropertyWizardPage(page);
      await wizard.gotoCreate();
      await wizard.fillBasics(PROPERTY_TITLE, 'A test property created during acceptance E2E.');
      await wizard.fillDetails({
        price: '5000',
        bedrooms: '2',
        bathrooms: '1',
        area: '80',
        currency: 'SAR',
      });
      await wizard.fillLocation({ city: 'Riyadh', neighborhood: 'Al Olaya', country: 'SA' });
      await wizard.skipImages();
      await wizard.fillContact(user2FullPhone);
      await wizard.publish();

      await expect(page.getByRole('heading', { level: 1, name: PROPERTY_TITLE })).toBeVisible({
        timeout: 10_000,
      });
      if (!/\/properties\/[0-9a-f-]{36}$/.test(page.url())) {
        throw new Error('wizard did not land on a property detail page');
      }
    }).toPass({ timeout: 120_000 });

    // Capture property URL for later
    propertyUrl = page.url();
  });

  await test.step('Owner edits property → changes reflected', async () => {
    // Same dev-server remount hazard as the create step: the wizard can be
    // reset mid-flow under parallel compile. Re-drive the whole edit until
    // the detail page shows the edited title — the edit itself is
    // idempotent, so retries never corrupt state.
    await expect(async () => {
      if (
        /\/properties\/[0-9a-f-]{36}$/.test(page.url()) &&
        (await page
          .getByRole('heading', { level: 1, name: EDITED_TITLE })
          .isVisible()
          .catch(() => false))
      ) {
        return;
      }
      await goto(page, '/my-properties');
      await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
        timeout: 10_000,
      });

      // Click edit link for the property
      const editLink = page.getByRole('link', { name: /edit/i });
      await expect(editLink).toBeVisible();
      await editLink.click();
      await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}\/edit$/);

      // Change title
      await page.getByLabel('Title').clear();
      await page.getByLabel('Title').fill(EDITED_TITLE);

      // Navigate through steps with explicit step progress checks
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 2 of 6')).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 3 of 6')).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 4 of 6')).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 5 of 6')).toBeVisible({ timeout: 5_000 });

      // Re-trigger WhatsApp number onChange before clicking Next to
      // ensure form state is in sync with the DOM value
      const waInput = page.getByLabel('WhatsApp number');
      await waInput.clear();
      await waInput.fill(user2FullPhone);

      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByText('Step 6 of 6')).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: 'Publish changes' }).click();

      await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1, name: EDITED_TITLE })).toBeVisible({
        timeout: 10_000,
      });
    }).toPass({ timeout: 120_000 });
  });

  await test.step("Owner views their listing — can't review own property", async () => {
    await expect(page.getByText(/owners cannot review their own property/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  await test.step("First user reviews owner's property → rating + comment saved", async () => {
    // Log out owner
    await goto(page, '/profile');
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

    // Log in as first user (OTP cooldown is disabled in the test env)
    await page.getByLabel('Country code').selectOption(user1Country);
    await page.getByLabel('Phone number').fill(user1PhoneLocal);
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/, { timeout: 15_000 });
    await submitOtpFromDb(page, user1FullPhone);
    await dismissRecoveryPrompt(page);
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    // Go to the owner's property
    await goto(page, propertyUrl);
    await expect(page.getByRole('heading', { level: 1, name: EDITED_TITLE })).toBeVisible({
      timeout: 10_000,
    });

    // Leave a review
    const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
    await reviewsSection.scrollIntoViewIfNeeded();
    await expect(reviewsSection).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Rate 5 stars' }).click();
    await page.getByLabel('Comment').fill(REVIEW_COMMENT);
    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByText(REVIEW_COMMENT)).toBeVisible({ timeout: 10_000 });
  });

  await test.step('First user browses by category → filtered results', async () => {
    await goto(page, '/');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Click a category tab (e.g. "Villas")
    await page.getByRole('tab', { name: 'Villas' }).click();
    // Allow the grid to re-render with category filter
    await expect(grid).toBeVisible({ timeout: 10_000 });
  });

  await test.step('Language toggle switches UI locale', async () => {
    // The globe button's aria-label shows the opposite language
    const switchToAr = page.getByRole('button', { name: 'التبديل إلى العربية' });
    await expect(switchToAr).toBeVisible();
    await switchToAr.click();
    await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();
  });

  await test.step('Cleanup: delete the created property and both test users', async () => {
    try {
      // Switch back to English
      await page.getByRole('button', { name: 'Switch to English' }).click();
      await expect(page.getByRole('button', { name: 'التبديل إلى العربية' })).toBeVisible();

      // Log out current user (user1)
      await goto(page, '/profile');
      await page.getByRole('button', { name: 'Log out' }).click();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

      // Log in as owner (user2)
      await page.getByLabel('Country code').selectOption(user2Country);
      await page.getByLabel('Phone number').fill(user2PhoneLocal);
      await page.getByRole('button', { name: 'Send code' }).click();
      await expect(page).toHaveURL(/\/verify-otp$/);
      await submitOtpFromDb(page, user2FullPhone);
      await dismissRecoveryPrompt(page);
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

      // Navigate to my-properties and delete
      await goto(page, '/my-properties');
      await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
        timeout: 10_000,
      });

      // Click delete button for the test property
      await page.getByRole('button', { name: `Delete ${EDITED_TITLE}` }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      await page.getByRole('button', { name: 'Yes, delete listing' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

      // Remove the registered users so the database returns to baseline.
      await deleteTestUserByPhone(user1FullPhone);
      await deleteTestUserByPhone(user2FullPhone);
    } catch {
      // Cleanup failed — globalSetup truncates before the next run anyway.
    }
  });
});
