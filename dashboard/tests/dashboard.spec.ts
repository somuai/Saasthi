import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Shaasthi/);
});

test('risk chart renders', async ({ page }) => {
  await page.goto('/');
  // Basic check for the risk dashboard
  await expect(page.locator('text=Risk Assessment Trend')).toBeVisible();
});
