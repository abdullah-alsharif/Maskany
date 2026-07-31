import { expect, test } from '@playwright/test';
import { loginAsUser, getLatestOtpCode } from './test-helpers';

test.describe('Flow edge cases', () => {
  test('guest visiting /favorites renders page without redirect', async ({ page }) => {
    await page.goto('/favorites');
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByRole('heading', { name: 'No favorites yet' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('owner can reach /my-properties after logging in', async ({ page }) => {
    await page.goto('/my-properties');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Country code').selectOption('+966');
    await page.getByLabel('Phone number').fill('501111001');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page).toHaveURL(/\/verify-otp$/);

    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await getLatestOtpCode('+966501111001');
          return code !== null;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    for (let i = 0; i < code!.length; i += 1) {
      await page.getByLabel(`Digit ${i + 1}`).type(code![i]!);
    }

    const recoveryButton = page.getByRole('button', { name: "I've saved these codes" });
    try {
      await recoveryButton.waitFor({ timeout: 5_000 });
      await recoveryButton.click();
    } catch {
      // No recovery prompt.
    }

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    await page.goto('/my-properties');
    await expect(page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('browser user visiting /insights is redirected', async ({ page }) => {
    await loginAsUser(page, '+966', '501111004');
    await page.goto('/insights');
    await expect(page).not.toHaveURL(/\/insights$/);
  });

  test('browser user visiting /my-properties is redirected', async ({ page }) => {
    await loginAsUser(page, '+966', '501111004');
    await page.goto('/my-properties');
    await expect(page).not.toHaveURL(/\/my-properties$/);
  });
});
