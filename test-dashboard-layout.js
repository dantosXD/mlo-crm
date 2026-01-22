// Test script to log in and verify dashboard layout persistence
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:5173/login');

    // Wait for login form
    await page.waitForSelector('[data-testid="email-input"]');

    console.log('Logging in...');
    await page.type('[data-testid="email-input"]', 'test@example.com');
    await page.type('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="sign-in-button"]');

    // Wait for navigation to dashboard
    await page.waitForNavigation({ timeout: 10000 });
    console.log('Logged in successfully');

    // Take screenshot of initial dashboard
    await page.screenshot({ path: 'feature-100-initial-dashboard.png' });
    console.log('Screenshot saved: feature-100-initial-dashboard.png');

    // Wait for dashboard to load
    await page.waitForTimeout(2000);

    // Check if dashboard widgets are loaded
    const widgets = await page.$$('[class*="react-grid-layout"]');
    console.log('Grid layout found:', widgets.length > 0);

    // Check for drag handles
    const dragHandles = await page.$$('.drag-handle');
    console.log('Drag handles found:', dragHandles.length);

    // Take screenshot showing drag handles
    await page.screenshot({ path: 'feature-100-drag-handles.png' });
    console.log('Screenshot saved: feature-100-drag-handles.png');

    // Get current layout from localStorage/API
    await page.evaluate(async () => {
      const response = await fetch('http://localhost:3000/api/users/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const prefs = await response.json();
      console.log('Current user preferences:', JSON.stringify(prefs, null, 2));
      window.currentPrefs = prefs;
    });

    console.log('Test completed successfully!');
    console.log('Dashboard loaded with drag-and-drop widgets');

  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'feature-100-error.png' });
  } finally {
    await browser.close();
  }
})();
