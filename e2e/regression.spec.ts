import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3002/api';

async function assertDashboard(page: {
  getByRole: Function;
  locator: Function;
}) {
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
}

async function loginUi(page: any, email: string) {
  await page.goto(`${baseUrl}/login`);
  const emailInput = page.getByTestId('email-input');
  const loginFormVisible = await emailInput.isVisible({ timeout: 2_000 }).catch(() => false);
  if (!loginFormVisible) {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    return;
  }
  await emailInput.fill(email);
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

async function readClientTabCount(page: any, label: string): Promise<number> {
  const tab = page.getByRole('tab', { name: new RegExp(`^${label} \\(`) }).first();
  await expect(tab).toBeVisible();
  const text = await tab.innerText();
  const match = text.match(/\((\d+)\)/);
  return match ? Number(match[1]) : -1;
}

test('desktop regression smoke', async ({ page, request, browser }) => {
  // Seed minimal test client via API.
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

  const createTaskRes = await request.post(`${apiBaseUrl}/tasks`, {
    data: {
      text: `Regression task ${now}`,
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

  const createNoteRes = await request.post(`${apiBaseUrl}/notes`, {
    data: {
      clientId: createdClient.id,
      text: `Regression note ${now}`,
      tags: ['regression'],
    },
    headers: {
      Authorization: `Bearer ${adminAuth.accessToken}`,
      'X-CSRF-Token': adminAuth.csrfToken,
    },
  });
  expect(createNoteRes.ok()).toBeTruthy();

  const createCommunicationRes = await request.post(`${apiBaseUrl}/communications`, {
    data: {
      clientId: createdClient.id,
      type: 'EMAIL',
      subject: `Regression communication ${now}`,
      body: 'Regression communication body',
    },
    headers: {
      Authorization: `Bearer ${adminAuth.accessToken}`,
      'X-CSRF-Token': adminAuth.csrfToken,
    },
  });
  expect(createCommunicationRes.ok()).toBeTruthy();

  const workflowName = `Regression Manual Workflow ${now}`;
  const workflowGeneratedNote = `Workflow run note ${now}`;
  const createWorkflowRes = await request.post(`${apiBaseUrl}/workflows`, {
    data: {
      name: workflowName,
      description: 'Regression workflow for run/test context',
      triggerType: 'MANUAL',
      actions: [
        {
          type: 'CREATE_NOTE',
          description: 'Create note from regression workflow',
          config: {
            text: workflowGeneratedNote,
          },
        },
      ],
    },
    headers: {
      Authorization: `Bearer ${adminAuth.accessToken}`,
      'X-CSRF-Token': adminAuth.csrfToken,
    },
  });
  expect(createWorkflowRes.ok()).toBeTruthy();
  const createdWorkflow = await createWorkflowRes.json();

  // Admin auth through real login flow.
  await loginUi(page, 'admin@example.com');
  await page.goto(baseUrl);
  await assertDashboard(page);

  // Client details should render and tab counters should remain stable through tab switching.
  await page.goto(`${baseUrl}/clients/${createdClient.id}`);
  await expect(page.getByRole('heading', { name: clientName })).toBeVisible({ timeout: 20000 });

  const notesCountBefore = await readClientTabCount(page, 'Notes');
  const tasksCountBefore = await readClientTabCount(page, 'Tasks');
  const commCountBefore = await readClientTabCount(page, 'Communications');

  await page.getByRole('tab', { name: /^Communications \(/ }).click();
  await expect(page.getByRole('button', { name: 'Compose New' })).toBeVisible();
  await page.getByRole('tab', { name: /^Tasks \(/ }).click();
  await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible();
  await page.getByRole('tab', { name: /^Notes \(/ }).click();
  await expect(page.getByRole('button', { name: 'Add Note' })).toBeVisible();

  const notesCountAfter = await readClientTabCount(page, 'Notes');
  const tasksCountAfter = await readClientTabCount(page, 'Tasks');
  const commCountAfter = await readClientTabCount(page, 'Communications');
  expect(notesCountAfter).toBe(notesCountBefore);
  expect(tasksCountAfter).toBe(tasksCountBefore);
  expect(commCountAfter).toBe(commCountBefore);

  // Calendar new event modal should open with no crash.
  await page.goto(`${baseUrl}/calendar`);
  await page.getByRole('button', { name: 'New Event' }).click();
  await expect(page.getByRole('heading', { name: 'New Event', exact: true })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Pipeline view toggle should switch deterministically.
  await page.goto(`${baseUrl}/pipeline`);
  await expect(page.getByTestId('pipeline-view-board')).toBeVisible();
  await page.getByTestId('pipeline-view-table-toggle').click();
  await expect(page.getByTestId('pipeline-view-table')).toBeVisible();
  await page.getByTestId('pipeline-view-board-toggle').click();
  await expect(page.getByTestId('pipeline-view-board')).toBeVisible();

  // Settings profile phone should persist after reload.
  const primaryPhoneCandidate = `555-88${String(now).slice(-4)}`;
  await page.goto(`${baseUrl}/settings`);
  const phoneInput = page.getByLabel('Phone Number');
  const existingPhone = await phoneInput.inputValue();
  const persistedPhone = existingPhone === primaryPhoneCandidate
    ? `555-77${String(now + 1).slice(-4)}`
    : primaryPhoneCandidate;
  await phoneInput.fill('');
  await phoneInput.fill(persistedPhone);
  const saveChangesButton = page.getByRole('button', { name: /save changes/i });
  await expect(saveChangesButton).toBeEnabled();
  await saveChangesButton.click();
  await page.reload();
  await expect(page.getByLabel('Phone Number')).toHaveValue(persistedPhone);

  // Workflow executions search should render empty state with no stale paginator.
  await page.goto(`${baseUrl}/workflows?tab=executions`);
  const uniqueSearch = `zzzz-no-execution-match-${now}-${Math.random().toString(36).slice(2, 8)}`;
  await page.getByPlaceholder('Search by workflow name or execution ID...').fill(uniqueSearch);
  await expect(page.getByText('No executions found')).toBeVisible();
  await expect(page.locator('.mantine-Pagination-root:visible')).toHaveCount(0);

  // Communications compose should show seeded client in picker.
  await page.goto(`${baseUrl}/communications/compose`);
  await page.getByRole('textbox', { name: 'Client', exact: true }).click();
  await expect(page.getByRole('option', { name: clientName, exact: true })).toBeVisible();

  // Template create should succeed.
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

  // Workflow test/run should support explicit client context and expose output.
  await page.goto(`${baseUrl}/workflows`);
  await page.getByPlaceholder('Search workflows...').fill(workflowName);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(workflowName)).toBeVisible();

  await page.getByRole('button', { name: `Test workflow ${workflowName}` }).click();
  const testModal = page.getByRole('dialog', { name: 'Test Workflow With Context' });
  await expect(testModal).toBeVisible();
  await testModal.getByRole('textbox', { name: 'Client' }).click();
  await page.getByRole('option', { name: new RegExp(`^${clientName} \\(LEAD\\)$`) }).click();
  await testModal.getByLabel('Trigger Data (optional)').fill('{"source":"regression-test"}');
  await testModal.getByRole('button', { name: 'Run Test' }).click();
  await expect(testModal.getByText(/Workflow Would Execute|Workflow Would NOT Execute/)).toBeVisible();
  await expect(testModal.getByText('Output')).toBeVisible();
  await testModal.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: `Run workflow ${workflowName}` }).click();
  const runModal = page.getByRole('dialog', { name: 'Run Workflow With Context' });
  await expect(runModal).toBeVisible();
  await runModal.getByRole('textbox', { name: 'Client' }).click();
  await page.getByRole('option', { name: new RegExp(`^${clientName} \\(LEAD\\)$`) }).click();
  await runModal.getByLabel('Trigger Data (optional)').fill('{"source":"regression-run"}');
  await runModal.getByRole('button', { name: 'Run Workflow' }).click();
  await expect(runModal.getByText('Workflow Executed', { exact: true }).first()).toBeVisible({ timeout: 20000 });
  await expect(runModal.getByRole('button', { name: 'Open Execution Logs' })).toBeVisible();
  await runModal.getByRole('button', { name: 'Open Execution Logs' }).click();

  await expect(page).toHaveURL(new RegExp(`tab=executions`));
  await expect(page).toHaveURL(new RegExp(`workflow_id=${createdWorkflow.id}`));
  await expect(page).toHaveURL(/execution_id=/);
  await expect(page.getByText('Execution Details')).toBeVisible({ timeout: 20000 });

  const notesAfterRunRes = await request.get(`${apiBaseUrl}/notes?client_id=${createdClient.id}`, {
    headers: {
      Authorization: `Bearer ${adminAuth.accessToken}`,
    },
  });
  expect(notesAfterRunRes.ok()).toBeTruthy();
  const notesAfterRun = await notesAfterRunRes.json();
  expect(Array.isArray(notesAfterRun)).toBeTruthy();
  const hasWorkflowNote = notesAfterRun.some((note: any) => note.text === workflowGeneratedNote);
  expect(hasWorkflowNote).toBeTruthy();

  // Viewer RBAC checks.
  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await loginUi(viewerPage, 'viewer@example.com');
  await viewerPage.goto(baseUrl);
  await assertDashboard(viewerPage);

  await viewerPage.goto(`${baseUrl}/communications`);
  await expect(viewerPage.getByRole('button', { name: 'Compose' })).toHaveCount(0);
  await viewerContext.close();
});
