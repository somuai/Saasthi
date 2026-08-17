import { chromium } from 'playwright';

(async () => {
  console.log('Starting full integration mock test...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Mock local storage to simulate logged in state
  await page.addInitScript(() => {
    window.localStorage.setItem('access_token', 'mock_token');
    window.localStorage.setItem('refresh_token', 'mock_refresh');
  });

  // Mock /auth/me/
  await page.route('**/api/v1/auth/me/', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        phone_number: "+91 9876543210",
        role: "supervisor",
        is_supervisor: true
      })
    });
  });

  // Intercept and mock backend API calls (Full Integration Mock)
  await page.route('**/api/v1/risk/assessments/', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 101, patient: { id: 452, name: "Aaradhya Devi", age: 26 }, severity: "CRITICAL", score: 0.92, ai_rationale: "Patient exhibits severe anemia (Hb 6.8 g/dL) combined with late third-trimester spotting. Immediate medical intervention is required to prevent maternal and fetal complications during delivery.", is_acknowledged: false, created_at: new Date().toISOString() },
        { id: 102, patient: { id: 893, name: "Kavita Rao", age: 31 }, severity: "HIGH", score: 0.78, ai_rationale: "Consistent high blood pressure readings (150/100) over the past two weeks. Symptoms indicate risk of preeclampsia.", is_acknowledged: false, created_at: new Date().toISOString() },
      ])
    });
  });

  await page.route('**/api/v1/incentives/', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 201, asha_worker: { id: 10, name: "Sunita S.", phone_number: "+91 9876543210" }, activity_type: "ANC_VISIT_Q1", amount: "250.00", status: "PENDING", created_at: new Date().toISOString() },
        { id: 202, asha_worker: { id: 14, name: "Meena M.", phone_number: "+91 8765432109" }, activity_type: "INSTITUTIONAL_DELIVERY_ESCORT", amount: "600.00", status: "PENDING", created_at: new Date(Date.now() - 43200000).toISOString() },
      ])
    });
  });

  await page.route('**/api/v1/users/workers/locations/', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { worker_id: 1, latitude: 20.6, longitude: 78.9, last_updated: new Date().toISOString(), status: "active" },
        { worker_id: 2, latitude: 21.0, longitude: 79.1, last_updated: new Date().toISOString(), status: "active" },
      ])
    });
  });

  // Verify Home Page (Dashboard)
  console.log('Verifying Home Page...');
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/home_page.png' });

  // Verify Triage Page
  console.log('Verifying Triage Page...');
  await page.goto('http://localhost:3000/triage');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/triage_page.png' });

  // Verify Patients Registry Page
  console.log('Verifying Patients Registry...');
  await page.goto('http://localhost:3000/patients');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/patients_registry.png' });

  // Click on the first patient row to open the drawer
  try {
    await page.click('tbody tr:first-child');
    await page.waitForTimeout(1000); // wait for drawer animation
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/patient_detail_drawer_overview.png' });
    
    // Click Vitals tab
    await page.click('text="Vitals"');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/patient_detail_drawer_vitals.png' });
    
    // Click AI Insights tab
    await page.click('text="AI Insights"');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/patient_detail_drawer_ai.png' });
    
  } catch(e) {
    console.log("Could not open patient drawer:", e.message);
  }

  // Verify Workers Page (Supervisor Only)
  console.log('Verifying Workers Page...');
  await page.goto('http://localhost:3000/workers');
  await page.waitForTimeout(3000); // Wait for map to load
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/workers_page_split.png' });

  // Try Map View
  try {
    await page.click('text="Map"');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/workers_page_map.png' });
  } catch {}

  // Try List View and open drawer
  try {
    await page.click('text="List"');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/workers_page_list.png' });

    // Click on the first worker row
    await page.click('tbody tr:first-child');
    await page.waitForTimeout(1000); // wait for drawer animation
    await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/worker_detail_drawer.png' });
  } catch(e) {
    console.log("Could not open worker drawer:", e.message);
  }

  // Verify Incentives Page
  console.log('Verifying Incentives Page...');
  await page.goto('http://localhost:3000/incentives');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/incentives_page.png' });

  // Verify Map Page (God View)
  console.log('Verifying Map Page...');
  await page.goto('http://localhost:3000/map');
  await page.waitForTimeout(2000);
  // Click the simulate button
  try {
    await page.click('button:has-text("Simulate")');
    await page.waitForTimeout(1000);
  } catch(e) {
    console.log("Simulate button not found or error:", e.message);
  }
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/map_page.png' });

  // Verify Analytics Page
  console.log('Verifying Analytics Page...');
  await page.goto('http://localhost:3000/analytics');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/analytics_page.png' });

  // Verify Alerts Page
  console.log('Verifying Alerts Page...');
  await page.goto('http://localhost:3000/alerts');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/alerts_page.png' });

  // Verify Settings Page
  console.log('Verifying Settings Page...');
  await page.goto('http://localhost:3000/settings');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/settings_page.png' });

  // Test Login Page (clear storage first)
  console.log('Verifying Login Page...');
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/soumyajitghosh/.gemini/antigravity/brain/af68f056-7a50-422a-94a6-fe5e7e05f20c/login_page.png' });

  await browser.close();
  console.log('Integration mock test complete. Screenshots saved.');
})();
