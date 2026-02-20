import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3002/api';

type FailedApiRequest = {
  url: string;
  status: number;
  method: string;
};

type RouteCheck = {
  route: string;
  label: string;
  status: 'PASS' | 'FAIL';
  httpStatus: number | null;
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: FailedApiRequest[];
  flags: string[];
  screenshot: string;
};

const outputRoot = path.resolve('output/playwright/launch-audit');
const screenshotsDir = path.join(outputRoot, 'screenshots');
const reportJson = path.join(outputRoot, 'launch-audit-results.json');

function slug(input: string): string {
  const normalized = input
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || 'root';
}

function isCriticalApiFailure(url: string, status: number, method: string): boolean {
  if (!url.includes('/api/') || method.toUpperCase() === 'OPTIONS') {
    return false;
  }

  if (url.includes('/api/auth/refresh') && status === 400) {
    return false;
  }

  return status >= 400;
}

async function loginUi(page: any, email: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill('password123');
  await page.getByTestId('sign-in-button').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
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
  };
}

async function runRouteCheck(page: any, route: string, label: string): Promise<RouteCheck> {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: FailedApiRequest[] = [];

  const onPageError = (err: Error) => pageErrors.push(err.message);
  const onConsole = (msg: any) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  };
  const onResponse = (resp: any) => {
    const status = resp.status();
    const url = resp.url();
    const method = resp.request().method();

    if (isCriticalApiFailure(url, status, method)) {
      failedRequests.push({ url, status, method });
    }
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('response', onResponse);

  let httpStatus: number | null = null;
  let flags: string[] = [];
  let status: RouteCheck['status'] = 'PASS';

  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    httpStatus = response?.status() ?? null;
    await page.waitForTimeout(1200);

    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    if (bodyText.includes('page not found') || bodyText.includes('something went wrong')) {
      flags.push('Error content rendered');
      status = 'FAIL';
    }

    if (bodyText.includes('access denied')) {
      flags.push('Access denied rendered for admin route sweep');
      status = 'FAIL';
    }

    if (httpStatus !== null && httpStatus >= 400) {
      flags.push(`Document response status ${httpStatus}`);
      status = 'FAIL';
    }

    if (pageErrors.length > 0) {
      flags.push(`${pageErrors.length} page errors`);
      status = 'FAIL';
    }

    if (consoleErrors.length > 0) {
      flags.push(`${consoleErrors.length} console errors`);
      status = 'FAIL';
    }

    if (failedRequests.length > 0) {
      flags.push(`${failedRequests.length} failed critical API requests`);
      status = 'FAIL';
    }
  } finally {
    const screenshotPath = path.join(screenshotsDir, `${slug(route)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    page.off('response', onResponse);

    return {
      route,
      label,
      status,
      httpStatus,
      pageErrors,
      consoleErrors,
      failedRequests,
      flags,
      screenshot: screenshotPath,
    };
  }
}

test.describe('launch audit', () => {
  test('desktop route + strict quality gate sweep', async ({ page, request, browser }) => {
    test.setTimeout(8 * 60 * 1000);
    fs.mkdirSync(screenshotsDir, { recursive: true });

    await page.goto(`${baseUrl}/login`);
    await page.getByTestId('email-input').fill('admin@example.com');
    await page.getByTestId('password-input').fill('wrong-password');
    await page.getByTestId('sign-in-button').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(`${baseUrl}/clients`);
    await expect(anonPage).toHaveURL(/\/login/, { timeout: 15000 });
    await anon.close();

    const adminAuth = await loginApi(request, 'admin@example.com', 'password123');
    const now = Date.now();
    const clientName = `Launch Audit Client ${now}`;
    const templateName = `Launch Audit Template ${now}`;
    const taskName = `Launch Audit Task ${now}`;

    const createClientRes = await request.post(`${apiBaseUrl}/clients`, {
      data: {
        name: clientName,
        email: `launch-audit-${now}@example.com`,
        phone: '555-111-2233',
        status: 'LEAD',
      },
      headers: {
        Authorization: `Bearer ${adminAuth.accessToken}`,
        'X-CSRF-Token': adminAuth.csrfToken,
      },
    });
    expect(createClientRes.ok()).toBeTruthy();
    const createdClient = await createClientRes.json();

    const createTaskRes = await request.post(`${apiBaseUrl}/tasks`, {
      data: {
        text: taskName,
        type: 'GENERAL',
        priority: 'MEDIUM',
        status: 'TODO',
        clientId: createdClient.id,
      },
      headers: {
        Authorization: `Bearer ${adminAuth.accessToken}`,
        'X-CSRF-Token': adminAuth.csrfToken,
      },
    });
    expect(createTaskRes.ok()).toBeTruthy();
    const createdTask = await createTaskRes.json();

    await loginUi(page, 'admin@example.com');

    const routes: Array<{ route: string; label: string }> = [
      { route: '/', label: 'Dashboard' },
      { route: '/today', label: 'Today' },
      { route: '/clients', label: 'Clients' },
      { route: `/clients/${createdClient.id}`, label: 'Client Details' },
      { route: '/calendar', label: 'Calendar' },
      { route: '/reminders', label: 'Reminders' },
      { route: '/pipeline', label: 'Pipeline' },
      { route: '/tasks', label: 'Tasks' },
      { route: '/notes', label: 'Notes' },
      { route: '/documents', label: 'Documents' },
      { route: '/communications', label: 'Communications Hub' },
      { route: '/communication-templates/new', label: 'Template Editor' },
      { route: '/communications/compose', label: 'Composer' },
      { route: '/calculator', label: 'Calculator' },
      { route: '/loan-scenarios', label: 'Loan Scenarios' },
      { route: '/loan-programs', label: 'Loan Programs' },
      { route: '/analytics', label: 'Analytics' },
      { route: '/workflows', label: 'Workflows' },
      { route: '/workflows/builder', label: 'Workflow Builder' },
      { route: '/settings', label: 'Settings' },
      { route: '/admin', label: 'Admin' },
    ];

    const results: RouteCheck[] = [];
    for (const item of routes) {
      results.push(await runRouteCheck(page, item.route, item.label));
    }

    // Critical flow: clients search + open detail
    await page.goto(`${baseUrl}/clients`);
    await page.getByPlaceholder('Search clients...').fill(clientName);
    const clientResult = page.locator('table').getByText(clientName).first();
    await expect(clientResult).toBeVisible();
    await page.goto(`${baseUrl}/clients/${createdClient.id}`);
    await expect(page.getByRole('heading', { name: clientName })).toBeVisible();

    // Critical flow: task status transition
    await page.goto(`${baseUrl}/tasks`);
    await page.getByPlaceholder('Search tasks...').fill(taskName);
    const taskRow = page.locator('tr', { hasText: taskName }).first();
    await expect(taskRow).toBeVisible();
    const completeTaskRes = await request.patch(`${apiBaseUrl}/tasks/${createdTask.id}/status`, {
      data: { status: 'COMPLETE' },
      headers: {
        Authorization: `Bearer ${adminAuth.accessToken}`,
        'X-CSRF-Token': adminAuth.csrfToken,
      },
    });
    expect(completeTaskRes.ok()).toBeTruthy();
    await page.reload();
    await page.getByPlaceholder('Search tasks...').fill(taskName);
    await expect(page.locator('tr', { hasText: taskName }).first()).toContainText('COMPLETE');

    // Critical flow: template create + compose prefill options
    await page.goto(`${baseUrl}/communication-templates/new`);
    await page.getByLabel('Template Name').fill(templateName);
    await page.getByLabel('Subject').fill(`Subject ${now}`);
    await page.getByLabel('Message Body').fill('Hello {{client_name}}');
    await page.getByRole('button', { name: 'Create Template' }).click();
    await page.waitForURL('**/communication-templates**');
    await page.goto(`${baseUrl}/communications/compose`);
    await page.getByRole('textbox', { name: 'Client', exact: true }).click();
    await expect(page.getByRole('option', { name: clientName, exact: true })).toBeVisible();
    await page.getByRole('option', { name: clientName, exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Client', exact: true })).toHaveValue(clientName);

    // Critical flow: workflow run-now response
    await page.goto(`${baseUrl}/workflows`);
    await page.getByTitle('Run Now').first().click();
    await expect(page.getByText(/Workflow Executed|Failed to execute workflow|Error/i)).toBeVisible();

    // RBAC checks with viewer role
    const viewer = await browser.newContext();
    const viewerPage = await viewer.newPage();
    await loginUi(viewerPage, 'viewer@example.com');
    await viewerPage.goto(`${baseUrl}/communications/compose`);
    const viewerComposeBlocked = (await viewerPage.locator('body').innerText()).toLowerCase().includes('access denied');
    await viewerPage.goto(`${baseUrl}/admin`);
    const viewerAdminBlocked = (await viewerPage.locator('body').innerText()).toLowerCase().includes('access denied');
    await viewer.close();

    const summary = {
      timestamp: new Date().toISOString(),
      baseUrl,
      apiBaseUrl,
      counts: {
        total: results.length,
        pass: results.filter((r) => r.status === 'PASS').length,
        fail: results.filter((r) => r.status === 'FAIL').length,
      },
      strictQualityGate: {
        zeroPageErrors: results.every((r) => r.pageErrors.length === 0),
        zeroConsoleErrors: results.every((r) => r.consoleErrors.length === 0),
        zeroFailedCriticalApiRequests: results.every((r) => r.failedRequests.length === 0),
      },
      rbac: {
        viewerComposeBlocked,
        viewerAdminBlocked,
      },
      results,
    };

    fs.mkdirSync(outputRoot, { recursive: true });
    fs.writeFileSync(reportJson, JSON.stringify(summary, null, 2), 'utf-8');

    expect(summary.counts.fail).toBe(0);
    expect(summary.strictQualityGate.zeroPageErrors).toBeTruthy();
    expect(summary.strictQualityGate.zeroConsoleErrors).toBeTruthy();
    expect(summary.strictQualityGate.zeroFailedCriticalApiRequests).toBeTruthy();
    expect(viewerComposeBlocked).toBeTruthy();
    expect(viewerAdminBlocked).toBeTruthy();
  });

  test('mobile spot checks', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await loginUi(page, 'admin@example.com');

    const mobileRoutes = ['/login', '/', '/clients', '/tasks', '/communications/compose'];
    const mobileShots: string[] = [];

    for (const route of mobileRoutes) {
      await page.goto(`${baseUrl}${route}`);
      await page.waitForTimeout(1000);
      const shot = path.join(screenshotsDir, `mobile-${slug(route)}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      mobileShots.push(shot);
    }

    await context.close();
    expect(mobileShots.length).toBe(mobileRoutes.length);
  });
});
