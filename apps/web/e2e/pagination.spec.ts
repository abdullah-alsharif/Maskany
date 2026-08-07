/**
 * E2E — Pagination (US3): the seed dataset has 24 properties (above the
 * 20/page threshold); verifies first-page size and API response shape.
 */
import { goto } from './test-helpers';
import { expect, test } from '@playwright/test';

test.describe('Pagination', () => {
  test('home page shows first page of properties', async ({ page }) => {
    await goto(page, '/');

    const grid = page.getByTestId('property-grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Page size 20 couples this spec to the API constant (same coupling
    // documented in home-infinite-scroll.spec.ts).
    await expect.poll(async () => grid.getByRole('article').count(), { timeout: 15_000 }).toBe(20);
  });

  test('pagination API returns correct structure with cursor', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/properties') && res.status() === 200,
    );

    await goto(page, '/');
    await page.getByTestId('property-grid').waitFor({ timeout: 15_000 });

    const response = await responsePromise;
    const body = await response.json();

    expect(body.properties).toHaveLength(20);

    // Infinite-scroll cursor: a base64url-encoded JSON payload carrying a
    // sort value plus the UUID of the last row (opaque to clients).
    expect(body.nextCursor).toBeTruthy();
    const cursorPayload = JSON.parse(
      Buffer.from(body.nextCursor as string, 'base64url').toString('utf8'),
    ) as { v?: unknown; i?: unknown };
    expect(cursorPayload.i).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
