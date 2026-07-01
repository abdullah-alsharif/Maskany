import { test, expect } from '@playwright/test';

test.describe('Core Web Vitals — Home Page', () => {
  test('LCP under 2.5s', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            resolve(last ? last.startTime : 0);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(-1), 10000);
        }),
    );

    expect(lcp).toBeLessThan(2500);
  });

  test('CLS under 0.1', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let cumulative = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              cumulative += (entry as any).value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(cumulative), 3000);
        }),
    );

    expect(cls).toBeLessThan(0.1);
  });

  test('Home page loads images lazily', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const images = page.locator('img[loading="lazy"]');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
  });
});
