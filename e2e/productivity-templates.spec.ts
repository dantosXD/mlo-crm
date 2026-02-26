import { expect, test } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3002/api';

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
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function loginApi(request: any, email: string, password: string) {
  const loginResponse = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { email, password },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginData = await loginResponse.json();

  const meResponse = await request.get(`${apiBaseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  });

  return {
    accessToken: loginData.accessToken,
    csrfToken: meResponse.headers()['x-csrf-token'],
  };
}

async function openQuickCapture(page: any) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog').last();
  const input = dialog.getByRole('textbox').first();
  await expect(input).toBeVisible();
  return { input, dialog };
}

test('productivity templates end-to-end acceptance', async ({ page, request }) => {
  test.setTimeout(8 * 60 * 1000);

  const now = Date.now();
  const templateNames = {
    note: `E2E Note Template ${now}`,
    task: `E2E Task Template ${now}`,
    reminder: `E2E Reminder Template ${now}`,
    activity: `E2E Activity Template ${now}`,
  };
  const followUpTaskText = `E2E Follow-up Task ${now}`;

  const auth = await loginApi(request, 'admin@example.com', 'password123');
  const createClientResponse = await request.post(`${apiBaseUrl}/clients`, {
    data: {
      name: `Templates E2E Client ${now}`,
      email: `templates-e2e-${now}@example.com`,
      phone: '555-120-8842',
      status: 'LEAD',
    },
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'X-CSRF-Token': auth.csrfToken,
    },
  });
  expect(createClientResponse.ok()).toBeTruthy();
  const client = await createClientResponse.json();

  await loginUi(page, 'admin@example.com');

  // Build templates in /templates
  await page.goto(`${baseUrl}/templates?tab=notes`);
  await page.getByRole('button', { name: /New Note Template/i }).click();
  const noteTemplateModal = page.getByRole('dialog');
  await expect(noteTemplateModal).toBeVisible();
  await noteTemplateModal.getByLabel(/Name/i).fill(templateNames.note);
  await noteTemplateModal.getByLabel(/Content/i).fill(`Default note content ${now}`);
  await noteTemplateModal.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(templateNames.note)).toBeVisible();

  await page.getByRole('tab', { name: 'Tasks' }).click();
  await page.getByRole('button', { name: /New Task Template/i }).click();
  const taskTemplateModal = page.getByRole('dialog');
  await expect(taskTemplateModal).toBeVisible();
  await taskTemplateModal.getByLabel(/Name/i).fill(templateNames.task);
  await taskTemplateModal.getByLabel(/Task Text/i).fill(`Default task text ${now}`);
  await taskTemplateModal.getByLabel(/^Type$/).click();
  await page.getByRole('option', { name: 'FOLLOW_UP' }).click();
  await taskTemplateModal.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(templateNames.task)).toBeVisible();

  await page.getByRole('tab', { name: 'Reminders' }).click();
  await page.getByRole('button', { name: /New Reminder Template/i }).click();
  const reminderTemplateModal = page.getByRole('dialog');
  await expect(reminderTemplateModal).toBeVisible();
  await reminderTemplateModal.getByLabel(/Name/i).fill(templateNames.reminder);
  await reminderTemplateModal.getByLabel(/Default Title/i).fill(`Default reminder ${now}`);
  await reminderTemplateModal.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(templateNames.reminder)).toBeVisible();

  await page.getByRole('tab', { name: 'Activities' }).click();
  await page.getByRole('button', { name: /New Activity Template/i }).click();
  const activityTemplateModal = page.getByRole('dialog');
  await expect(activityTemplateModal).toBeVisible();
  await activityTemplateModal.getByLabel(/Name/i).fill(templateNames.activity);
  await activityTemplateModal.getByLabel(/Default Activity Description/i).fill(`Default activity ${now}`);
  await activityTemplateModal.getByText('Enable Auto Follow-up').click({ timeout: 10_000 });
  await activityTemplateModal.getByLabel(/Default Task Text/i).fill(followUpTaskText);
  await activityTemplateModal.getByRole('button', { name: /^Save$/ }).click();
  await expect(page.getByText(templateNames.activity)).toBeVisible();

  // Verify legacy defaults still visible as system templates
  const notesTemplatesResponse = await request.get(`${apiBaseUrl}/notes/templates/list`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  expect(notesTemplatesResponse.ok()).toBeTruthy();
  const notesTemplates = await notesTemplatesResponse.json();
  expect(notesTemplates.some((t: any) => t.isSystem === true)).toBeTruthy();

  const tasksTemplatesResponse = await request.get(`${apiBaseUrl}/tasks/templates`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  expect(tasksTemplatesResponse.ok()).toBeTruthy();
  const tasksTemplates = await tasksTemplatesResponse.json();
  expect(Array.isArray(tasksTemplates)).toBeTruthy();
  expect(tasksTemplates.some((t: any) => t.name === templateNames.task)).toBeTruthy();

  await loginUi(page, 'admin@example.com');

  // Core forms
  await page.goto(`${baseUrl}/clients/${client.id}?tab=notes`);
  await page.getByRole('button', { name: /Add Note/i }).first().click();
  const noteTemplateInput = page.getByRole('textbox', { name: /Use Template \(optional\)/i }).first();
  await expect(noteTemplateInput).toBeEnabled();
  await noteTemplateInput.click();
  await page.getByRole('option', { name: templateNames.note }).click();
  await page.getByRole('button', { name: /^Save$/ }).click();

  await page.goto(`${baseUrl}/clients/${client.id}?tab=tasks`);
  await page.getByRole('button', { name: /Add Task/i }).first().click();
  const taskTemplateInput = page.getByRole('textbox', { name: /Use Template \(optional\)/i }).first();
  await expect(taskTemplateInput).toBeEnabled();
  await taskTemplateInput.click();
  await page.getByRole('option', { name: templateNames.task }).click();
  await page.getByRole('button', { name: /^Save$/ }).click();

  await page.goto(`${baseUrl}/reminders`);
  await page.getByRole('button', { name: /New Reminder/i }).click();
  const reminderDialog = page.getByRole('dialog');
  const reminderTemplateInput = reminderDialog.getByRole('textbox', { name: /Use Template \(optional\)/i }).first();
  await expect(reminderTemplateInput).toBeEnabled();
  await reminderTemplateInput.click();
  await page.getByRole('option', { name: templateNames.reminder }).click();
  await reminderDialog.getByRole('button', { name: /Create Reminder/i }).click();
  await expect(reminderDialog).not.toBeVisible({ timeout: 15_000 });

  await page.goto(`${baseUrl}/clients/${client.id}`);
  await page.getByRole('button', { name: /Log Interaction/i }).click();
  const interactionDialog = page.getByRole('dialog');
  const activityTemplateInput = interactionDialog.getByRole('textbox', { name: /Use Template \(optional\)/i }).first();
  await expect(activityTemplateInput).toBeEnabled();
  await activityTemplateInput.click();
  await page.getByRole('option', { name: templateNames.activity }).click();
  await interactionDialog.getByRole('button', { name: /Log Interaction/i }).click();
  if (await interactionDialog.isVisible()) {
    await page.keyboard.press('Escape');
  }

  await loginUi(page, 'admin@example.com');

  // QuickCapture flows
  const taskCapture = await openQuickCapture(page);
  await taskCapture.input.fill('/task ');
  await taskCapture.dialog.getByRole('textbox', { name: /Template \(optional\)/i }).click({ timeout: 10_000 });
  await page.getByRole('option', { name: templateNames.task }).click();
  await taskCapture.dialog.getByRole('button', { name: /Create from selected template/i }).click();
  await expect(taskCapture.dialog).not.toBeVisible({ timeout: 15_000 });

  const noteCapture = await openQuickCapture(page);
  await noteCapture.input.fill('/note ');
  await noteCapture.dialog.getByRole('textbox', { name: /Template \(optional\)/i }).click({ timeout: 10_000 });
  await page.getByRole('option', { name: templateNames.note }).click();
  await noteCapture.dialog.getByRole('button', { name: /Create from selected template/i }).click();
  await expect(page.getByText(/Select a client/i)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${client.name}.*${client.email}`) }).click();
  await expect(noteCapture.dialog).not.toBeVisible({ timeout: 15_000 });

  const reminderCapture = await openQuickCapture(page);
  await reminderCapture.input.fill('/reminder ');
  await reminderCapture.dialog.getByRole('textbox', { name: /Template \(optional\)/i }).click({ timeout: 10_000 });
  await page.getByRole('option', { name: templateNames.reminder }).click();
  await reminderCapture.dialog.getByRole('button', { name: /Create from selected template/i }).click();
  await expect(reminderCapture.dialog).not.toBeVisible({ timeout: 15_000 });

  const activityCapture = await openQuickCapture(page);
  await activityCapture.input.fill('/activity ');
  await activityCapture.dialog.getByRole('textbox', { name: /Template \(optional\)/i }).click({ timeout: 10_000 });
  await page.getByRole('option', { name: templateNames.activity }).click();
  await activityCapture.dialog.getByRole('button', { name: /Create from selected template/i }).click();
  await expect(page.getByText(/Select a client/i)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`${client.name}.*${client.email}`) }).click();

  // Follow-up verification from activity template (API-triggered to validate template auto follow-up behavior)
  const activityTemplatesResponse = await request.get(`${apiBaseUrl}/activities/templates`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  expect(activityTemplatesResponse.ok()).toBeTruthy();
  const activityTemplates = await activityTemplatesResponse.json();
  const createdActivityTemplate = activityTemplates.find((template: any) => template.name === templateNames.activity);
  expect(createdActivityTemplate).toBeTruthy();

  const refreshedMeResponse = await request.get(`${apiBaseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  expect(refreshedMeResponse.ok()).toBeTruthy();
  const latestCsrfToken = refreshedMeResponse.headers()['x-csrf-token'] || auth.csrfToken;

  const activityFromTemplateResponse = await request.post(`${apiBaseUrl}/activities`, {
    data: {
      clientId: client.id,
      templateId: createdActivityTemplate.id,
    },
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'X-CSRF-Token': latestCsrfToken,
    },
  });
  const activityFromTemplateStatus = activityFromTemplateResponse.status();
  const activityFromTemplateText = await activityFromTemplateResponse.text();
  expect(activityFromTemplateResponse.ok(), `POST /activities failed (${activityFromTemplateStatus}): ${activityFromTemplateText}`).toBeTruthy();
  const activityFromTemplate = JSON.parse(activityFromTemplateText);
  expect(activityFromTemplate.followUp?.id).toBeTruthy();

  const clientTasksResponse = await request.get(`${apiBaseUrl}/tasks?client_id=${client.id}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  expect(clientTasksResponse.ok()).toBeTruthy();
  const clientTasksPayload = await clientTasksResponse.json();
  const clientTasks = Array.isArray(clientTasksPayload) ? clientTasksPayload : (clientTasksPayload.tasks || []);
  expect(clientTasks.some((task: any) => task.id === activityFromTemplate.followUp.id)).toBeTruthy();
});
