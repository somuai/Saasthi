import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="tel"]', '9999999999');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);
  await page.fill('input[type="text"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000); // wait for redirect

  // Analytics
  await page.goto('http://localhost:3000/analytics');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/analytics_page.png' });

  // Alerts
  await page.goto('http://localhost:3000/alerts');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/alerts_page_initial.png' });
  
  try {
    const dispatchBtn = page.locator('button:has-text("Find & Dispatch")').first();
    await dispatchBtn.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/alerts_page_querying.png' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/alerts_page_dispatched.png' });
  } catch {}

  // Settings
  await page.goto('http://localhost:3000/settings');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/settings_page.png' });

  await browser.close();
  console.log("Screenshots captured!");
})();
