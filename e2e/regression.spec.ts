import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3000/api';

async function assertHeading(page: { getByRole: Function }, heading: string) {
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

async function assertDashboard(page: {
  getByRole: Function;
  locator: Function;
}) {
  await expect(page.getByRole('tab', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
}

async function loginUi(page: {
  goto: Function;
  getByTestId: Function;
}, email: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill('password123');
  await page.getByTestId('sign-in-button').click();
  await expect(page as any).not.toHaveURL(/\/login/, { timeout: 20000 });
}

async function loginApi(request: any, email: string, password: string) {
  const loginRes = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginData = await loginRes.json();

  const meRes = await request.get(`${apiBaseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  });
  const csrfToken = meRes.headers()['x-csrf-token'];

  return {
    accessToken: loginData.accessToken,
    csrfToken,
    user: loginData.user,
  };
}

test('desktop regression smoke', async ({ page, request, browser }) => {
  // Seed minimal test client via API
  const adminAuth = await loginApi(request, 'admin@example.com', 'password123');
  const now = Date.now();
  const clientName = `Regression E2E Client ${now}`;
  const clientEmail = `regression-${now}@example.com`;

  const createClientRes = await request.post(`${apiBaseUrl}/clients`, {
    data: {
      name: clientName,
      email: clientEmail,
      phone: '555-000-0000',
      status: 'LEAD',
    },
    headers: {
      Authorization: `Bearer ${adminAuth.accessToken}`,
      'X-CSRF-Token': adminAuth.csrfToken,
    },
  });
  expect(createClientRes.ok()).toBeTruthy();
  const createdClient = await createClientRes.json();

  // Admin auth through real login flow
  await loginUi(page, 'admin@example.com');
  await page.goto(baseUrl);
  await assertDashboard(page);

  // Client Details should render (no crash)
  const clientDetailsResponse = page.waitForResponse((resp) => {
    return resp.url().includes(`/api/clients/${createdClient.id}`) && resp.status() === 200;
  });
  await page.goto(`${baseUrl}/clients/${createdClient.id}`);
  await clientDetailsResponse;
  await expect(page.getByText('Client Not Found')).toHaveCount(0);
  await expect(page.getByText('Access Denied')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible({ timeout: 20000 });

  // Communications Compose should show clients
  await page.goto(`${baseUrl}/communications/compose`);
  await page.getByRole('textbox', { name: 'Client', exact: true }).click();
  await expect(page.getByRole('option', { name: clientName, exact: true })).toBeVisible();

  // Template create should succeed
  const templateName = `Regression Template ${now}`;
  await page.goto(`${baseUrl}/communication-templates/new`);
  await page.getByLabel('Template Name').fill(templateName);
  await page.getByLabel('Subject').fill('Regression Subject');
  await page.getByLabel('Message Body').fill('Hello {{client_name}}, welcome!');
  await page.getByRole('button', { name: 'Create Template' }).click();
  await page.waitForURL('**/communication-templates');
  await page.getByPlaceholder('Search templates...').fill(templateName);
  await page.getByPlaceholder('Search templates...').press('Enter');
  await expect(page.getByText(templateName)).toBeVisible();

  // Workflow Run Now should execute (no "Coming Soon")
  await page.goto(`${baseUrl}/workflows`);
  await page.getByTitle('Run Now').first().click();
  await expect(page.getByText('Coming Soon')).toHaveCount(0);
  await expect(page.getByText(/Workflow Executed|Failed to execute workflow|CSRF|Error/i)).toBeVisible();

  // Switch to Viewer and confirm compose is blocked
  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await loginUi(viewerPage, 'viewer@example.com');
  await viewerPage.goto(baseUrl);
  await assertDashboard(viewerPage);

  await viewerPage.goto(`${baseUrl}/communications`);
  await expect(viewerPage.getByRole('button', { name: 'Compose' })).toHaveCount(0);
  await viewerPage.goto(`${baseUrl}/communications/compose`);
  await assertHeading(viewerPage, 'Access Denied');
  await viewerContext.close();
});
