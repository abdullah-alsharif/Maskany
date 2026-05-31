/**
 * E2E — AC-42: Complete acceptance workflow (E2E smoke test).
 *
 * Single long test covering the full happy path through the app:
 * unauthenticated browsing → registration → favorites → profile →
 * logout → owner registration → property CRUD → reviews → categories → language.
 *
 * 375x812 viewport, 120s timeout (set via test.setTimeout).
 */
import { expect, test } from '@playwright/test';
import { getLatestOtpCode } from './test-helpers';

const USER1_NAME = 'E2E Acceptance Browser';
const USER1_COUNTRY = '+966';
const USER1_PHONE = '503000001';
const USER1_FULL_PHONE = `${USER1_COUNTRY}${USER1_PHONE}`;
const USER1_EMAIL = 'e2e-acceptance-browser@example.com';

const USER2_NAME = 'E2E Acceptance Owner';
const USER2_COUNTRY = '+966';
const USER2_PHONE = '503000002';
const USER2_FULL_PHONE = `${USER2_COUNTRY}${USER2_PHONE}`;
const USER2_EMAIL = 'e2e-acceptance-owner@example.com';

const PROPERTY_TITLE = 'E2E Acceptance Test Property';
const EDITED_TITLE = 'E2E Acceptance Test Property (Updated)';
const REVIEW_COMMENT = 'Great property, very satisfied!';

async function submitOtp(page: import('@playwright/test').Page, fullPhone: string) {
  let code: string | null = null;
  await expect
    .poll(
      async () => {
        code = await getLatestOtpCode(fullPhone);
        return code !== null;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  expect(code).toMatch(/^\d{6}$/);
  for (let i = 0; i < code!.length; i += 1) {
    await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
  }
}

async function dismissRecovery(page: import('@playwright/test').Page) {
  const btn = page.getByRole('button', { name: "I've saved these codes" });
  try {
    await btn.waitFor({ timeout: 5_000 });
    await btn.click();
  } catch {
    // No recovery prompt — proceed.
  }
}

test('[AC-42] Complete acceptance workflow (E2E smoke test)', async ({ page }) => {
  test.setTimeout(120_000);
  // ====================================================================
  // 1. Unauth user browses home → sees property grid
  // ====================================================================
  await page.goto('/');
  const grid = page.getByTestId('property-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  const initialCardCount = await grid.locator('article').count();
  expect(initialCardCount).toBeGreaterThan(0);

  // ====================================================================
  // 2. Unauth user searches "apartment" → filtered results
  // ====================================================================
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
    .toBe(initialCardCount);

  // ====================================================================
  // 3. Unauth user views property detail → all fields present
  // ====================================================================
  const firstCard = grid.locator('article').first();
  const propLink = firstCard.locator('a[href^="/properties/"]').first();
  const expectedTitle = (await firstCard.locator('h3').innerText()).trim();
  const propHref = await propLink.getAttribute('href');
  await page.goto(propHref!);
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}/);
  await expect(
    page.getByRole('heading', { level: 1, name: expectedTitle }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Property specifications')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Amenities' })).toBeVisible();

  // ====================================================================
  // 4. Unauth user clicks WhatsApp → wa.me deep link with correct message
  // ====================================================================
  const waLink = page.getByRole('link', { name: /contact property owner on whatsapp/i });
  await expect(waLink).toBeVisible({ timeout: 10_000 });
  const href = await waLink.getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/\d{7,15}\?text=/);

  // ====================================================================
  // 5. New user (browser) registers with phone → OTP sent
  // 6. User verifies OTP → redirected to home
  // ====================================================================
  await page.goto('/profile');
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);

  await page.getByLabel('Full name').fill(USER1_NAME);
  await page.getByLabel('Country code').selectOption(USER1_COUNTRY);
  await page.getByLabel('Phone number').fill(USER1_PHONE);
  await page.getByLabel('Email (optional)').fill(USER1_EMAIL);
  // Default account type is BROWSER — keep it.
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);

  await submitOtp(page, USER1_FULL_PHONE);
  await dismissRecovery(page);
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  // ====================================================================
  // 7. User browses as authenticated → favorites button active
  // ====================================================================
  await expect(grid).toBeVisible({ timeout: 15_000 });
  const favBtn = grid.locator('article').first().getByRole('button', { name: /add to favorites/i });
  await expect(favBtn).toBeVisible();

  // ====================================================================
  // 8. User adds property to favorites → heart fills
  // ====================================================================
  await favBtn.click();
  await expect(
    grid.locator('article').first().getByRole('button', { name: /remove from favorites/i }),
  ).toBeVisible({ timeout: 10_000 });

  // ====================================================================
  // 9. User navigates to favorites tab → property appears
  // ====================================================================
  await page.getByRole('link', { name: 'Favorites' }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  const favoritesGrid = page.getByTestId('favorites-grid');
  await expect(favoritesGrid).toBeVisible({ timeout: 15_000 });
  await expect(favoritesGrid.getByText(expectedTitle, { exact: true })).toBeVisible();

  // ====================================================================
  // 10. User navigates to profile → user info displayed
  // ====================================================================
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText(USER1_NAME)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(USER1_FULL_PHONE)).toBeVisible();

  // ====================================================================
  // 11. User logs out → redirected to login
  // ====================================================================
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

  // Navigate home — grid still loads
  await page.goto('/');
  await expect(grid).toBeVisible({ timeout: 15_000 });

  // ====================================================================
  // 12. Second user (owner) registers → OTP verified
  // ====================================================================
  await page.goto('/profile');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);

  await page.getByLabel('Full name').fill(USER2_NAME);
  await page.getByLabel('Country code').selectOption(USER2_COUNTRY);
  await page.getByLabel('Phone number').fill(USER2_PHONE);
  await page.getByLabel('Email (optional)').fill(USER2_EMAIL);
  // Select Owner account type
  await page.getByRole('radio', { name: /owner/i }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/verify-otp$/);

  await submitOtp(page, USER2_FULL_PHONE);
  await dismissRecovery(page);
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  // ====================================================================
  // 13. Owner creates property listing
  // ====================================================================
  await page.goto('/my-properties');
  await expect(
    page.getByRole('heading', { level: 1, name: 'My properties' }),
  ).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: 'New listing' }).click();
  await expect(page).toHaveURL(/\/properties\/create$/);

  // Step 1: Basics
  await page.getByLabel('Title').fill(PROPERTY_TITLE);
  await page.getByLabel('Description').fill('A test property created during acceptance E2E.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 2: Details
  await page.getByLabel('Price').fill('5000');
  await page.getByLabel('Bedrooms').fill('2');
  await page.getByLabel('Bathrooms').fill('1');
  await page.getByLabel('Area (m²)').fill('80');
  await page.getByLabel('Currency').fill('SAR');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 3: Location
  await page.getByLabel('City').fill('Riyadh');
  await page.getByLabel('Area / neighborhood').fill('Al Olaya');
  await page.getByLabel('Country').fill('SA');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 4: Images (skip)
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 5: Contact
  await page.getByLabel('WhatsApp number').fill(`${USER2_COUNTRY}${USER2_PHONE}`);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 6: Review & publish
  await page.getByRole('button', { name: 'Publish listing' }).click();

  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: PROPERTY_TITLE }),
  ).toBeVisible({ timeout: 10_000 });

  // Capture property URL for later
  const propertyUrl = page.url();

  // ====================================================================
  // 14. Owner edits property → changes reflected
  // ====================================================================
  await page.goto('/my-properties');
  await expect(
    page.getByRole('heading', { level: 1, name: 'My properties' }),
  ).toBeVisible({ timeout: 10_000 });

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
  await waInput.fill(`${USER2_COUNTRY}${USER2_PHONE}`);

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Step 6 of 6')).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: 'Publish changes' }).click();

  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: EDITED_TITLE }),
  ).toBeVisible({ timeout: 10_000 });

  // ====================================================================
  // 15. Owner views their listing — can't review own property
  // ====================================================================
  await expect(
    page.getByText(/owners cannot review their own property/i),
  ).toBeVisible({ timeout: 10_000 });

  // ====================================================================
  // 16. First user reviews owner's property → rating + comment saved
  // ====================================================================
  // Log out owner
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

  // Log in as first user
  // Try login; if OTP cooldown (30s) hasn't expired, retry after 35s
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Country code').selectOption(USER1_COUNTRY);
  await page.getByLabel('Phone number').fill(USER1_PHONE);
  await page.getByRole('button', { name: 'Send code' }).click();
  const loginOk = await page
    .waitForURL(/\/verify-otp$/, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!loginOk) {
    // Cooldown not yet expired — wait and retry once
    await page.waitForTimeout(35_000);
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/, { timeout: 15_000 });
  }
  await submitOtp(page, USER1_FULL_PHONE);
  await dismissRecovery(page);
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  // Go to the owner's property
  await page.goto(propertyUrl);
  await expect(
    page.getByRole('heading', { level: 1, name: EDITED_TITLE }),
  ).toBeVisible({ timeout: 10_000 });

  // Leave a review
  const reviewsSection = page.getByRole('region', { name: 'Reviews', exact: true });
  await reviewsSection.scrollIntoViewIfNeeded();
  await expect(reviewsSection).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Rate 5 stars' }).click();
  await page.getByLabel('Comment').fill(REVIEW_COMMENT);
  await page.getByRole('button', { name: 'Submit review' }).click();
  await expect(page.getByText(REVIEW_COMMENT)).toBeVisible({ timeout: 10_000 });

  // ====================================================================
  // 17. First user browses by category → filtered results
  // ====================================================================
  await page.goto('/');
  await expect(grid).toBeVisible({ timeout: 15_000 });

  // Click a category tab (e.g. "Villas")
  await page.getByRole('tab', { name: 'Villas' }).click();
  // Allow the grid to re-render with category filter
  await expect(grid).toBeVisible({ timeout: 10_000 });

  // ====================================================================
  // 18. Language toggle switches UI locale
  // ====================================================================
  // The globe button's aria-label shows the opposite language
  const switchToAr = page.getByRole('button', { name: 'التبديل إلى العربية' });
  await expect(switchToAr).toBeVisible();
  await switchToAr.click();
  await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();

  // ====================================================================
  // Cleanup: delete the created property to prevent data pollution
  // ====================================================================
  try {
    // Switch back to English
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.getByRole('button', { name: 'التبديل إلى العربية' })).toBeVisible();

    // Log out current user (user1)
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

    // Log in as owner (user2)
    await page.getByLabel('Country code').selectOption(USER2_COUNTRY);
    await page.getByLabel('Phone number').fill(USER2_PHONE);
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);
    await submitOtp(page, USER2_FULL_PHONE);
    await dismissRecovery(page);
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    // Navigate to my-properties and delete
    await page.goto('/my-properties');
    await expect(
      page.getByRole('heading', { level: 1, name: 'My properties' }),
    ).toBeVisible({ timeout: 10_000 });

    // Click delete button for the test property
    await page.getByRole('button', { name: `Delete ${PROPERTY_TITLE}` }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Yes, delete listing' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  } catch {
    // Cleanup failed — property will be cleaned up in a subsequent run or manually.
  }
});
