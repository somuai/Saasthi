import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/login');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Shaasthi/);
});

test('login form renders', async ({ page }) => {
  await page.goto('/login');
  // Basic check for the login view
  await expect(page.locator('text=Saasthi Admin')).toBeVisible();
  await expect(page.locator('button:has-text("Send OTP")')).toBeVisible();
});

