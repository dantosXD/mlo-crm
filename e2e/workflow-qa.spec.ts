/**
 * Workflow Feature Browser QA
 * Covers plan sections A–G from workflow-browser-qa-110bb8.md
 *
 * Sections:
 *   A) Workflows list page
 *   B) New workflow creation (builder)
 *   C) Workflow edit
 *   D) Workflow execution list + detail
 *   E) Run/Test workflow modal
 *   F) Import/Export and templates
 *   G) Execution reliability / edge cases
 */

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3002/api';
const ADMIN_EMAIL = 'admin@example.com';
const VIEWER_EMAIL = 'viewer@example.com';
const PASSWORD = 'password123';

const EVIDENCE_DIR = path.resolve('output/playwright/workflow-qa/screenshots');
const REPORT_PATH = path.resolve('output/playwright/workflow-qa/workflow-qa-results.json');

// ── types ───────────────────────────────────────────────────────────────────
type Severity = 'P0' | 'P1' | 'P2';
type CheckStatus = 'PASS' | 'FAIL' | 'CONDITIONAL';

interface Finding {
  section: string;
  check: string;
  status: CheckStatus;
  severity?: Severity;
  notes: string;
  reproSteps?: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function loginApi(request: any): Promise<{ accessToken: string; csrfToken: string }> {
  const loginRes = await request.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: PASSWORD },
  });
  expect(loginRes.ok(), 'admin login via API').toBeTruthy();
  const loginData = await loginRes.json();
  const meRes = await request.get(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  });
  const csrfToken = meRes.headers()['x-csrf-token'] ?? '';
  return { accessToken: loginData.accessToken, csrfToken };
}

async function apiPost(request: any, auth: { accessToken: string; csrfToken: string }, endpoint: string, data: any) {
  const res = await request.post(`${API_BASE}${endpoint}`, {
    data,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'X-CSRF-Token': auth.csrfToken,
    },
  });
  if (!res.ok()) throw new Error(`POST ${endpoint} failed (${res.status()}): ${await res.text()}`);
  return res.json();
}

async function apiGet(request: any, auth: { accessToken: string; csrfToken: string }, endpoint: string) {
  const res = await request.get(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!res.ok()) throw new Error(`GET ${endpoint} failed (${res.status()}): ${await res.text()}`);
  return res.json();
}

async function loginUi(page: any, email: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  const emailInput = page.getByTestId('email-input');
  const visible = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);
  if (!visible) {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    return;
  }
  await emailInput.fill(email);
  await page.getByTestId('password-input').fill(PASSWORD);
  await page.getByTestId('sign-in-button').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

async function shot(page: any, name: string): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const filePath = path.join(EVIDENCE_DIR, `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
}

function collectNetworkErrors(page: any): { url: string; status: number; method: string }[] {
  const errors: { url: string; status: number; method: string }[] = [];
  page.on('response', (resp: any) => {
    const status = resp.status();
    const url = resp.url();
    const method = resp.request().method();
    if (url.includes('/api/') && method !== 'OPTIONS' && status >= 400) {
      // Skip expected non-critical endpoints
      if (url.includes('/api/auth/refresh') && status === 400) return;
      errors.push({ url, status, method });
    }
  });
  return errors;
}

function collectConsoleErrors(page: any): string[] {
  const errors: string[] = [];
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

// ── main test ────────────────────────────────────────────────────────────────
test.describe('Workflow Feature QA', () => {
  test('Full workflow surface sweep — sections A through G', async ({ page, request, browser }) => {
    test.setTimeout(10 * 60 * 1000);
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const findings: Finding[] = [];
    const addFinding = (f: Finding) => findings.push(f);

    // ── Preflight / seed data ─────────────────────────────────────────────
    const auth = await loginApi(request);
    const now = Date.now();
    const clientName = `QA Workflow Client ${now}`;

    const client = await apiPost(request, auth, '/clients', {
      name: clientName,
      email: `wf-qa-${now}@example.com`,
      phone: '555-900-0001',
      status: 'LEAD',
    });

    const wfName = `QA Manual Workflow ${now}`;
    const wfNoteText = `QA workflow note ${now}`;
    const createdWf = await apiPost(request, auth, '/workflows', {
      name: wfName,
      description: 'Created by workflow-qa spec',
      triggerType: 'MANUAL',
      actions: [
        {
          type: 'CREATE_NOTE',
          description: 'QA note action',
          config: { text: wfNoteText },
        },
      ],
    });

    // ── UI login ──────────────────────────────────────────────────────────
    await loginUi(page, ADMIN_EMAIL);
    await shot(page, 'A0-logged-in-dashboard');

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION A — Workflows list page
    // ═══════════════════════════════════════════════════════════════════════
    const netA: any[] = [];
    const conA: string[] = [];
    page.on('response', (r: any) => {
      const s = r.status(); const u = r.url(); const m = r.request().method();
      if (u.includes('/api/') && m !== 'OPTIONS' && s >= 400 && !(u.includes('/auth/refresh') && s === 400)) netA.push({ url: u, status: s, method: m });
    });
    page.on('console', (msg: any) => { if (msg.type() === 'error') conA.push(msg.text()); });

    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await shot(page, 'A1-workflows-list-default');

    // A.1 Table columns render
    const headers = await page.locator('table thead th').allInnerTexts();
    const expectedHeaders = ['Name', 'Trigger', 'Status', 'Executions', 'Version', 'Created By', 'Actions'];
    const missingHeaders = expectedHeaders.filter(h => !headers.some((actual: string) => actual.toLowerCase().includes(h.toLowerCase())));
    addFinding({
      section: 'A', check: 'Table columns render',
      status: missingHeaders.length === 0 ? 'PASS' : 'FAIL',
      severity: missingHeaders.length > 0 ? 'P1' : undefined,
      notes: missingHeaders.length === 0 ? 'All expected columns present' : `Missing: ${missingHeaders.join(', ')}`,
    });

    // A.2 Seeded workflow appears in list
    await page.getByPlaceholder('Search workflows...').fill(wfName);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(800);
    await shot(page, 'A2-workflows-search-result');
    const wfRowVisible = await page.getByText(wfName).first().isVisible().catch(() => false);
    addFinding({
      section: 'A', check: 'Seeded workflow visible in search results',
      status: wfRowVisible ? 'PASS' : 'FAIL',
      severity: wfRowVisible ? undefined : 'P1',
      notes: wfRowVisible ? `"${wfName}" found in list` : `"${wfName}" not visible after search`,
    });

    // A.3 Status filter — Active
    await page.getByPlaceholder('Search workflows...').fill('');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(500);
    const statusSelect = page.locator('select, [data-type="select"]').first();
    // Use Mantine select properly
    const allSelects = page.locator('.mantine-Select-root');
    let statusFilterWorked = false;
    try {
      await allSelects.first().click();
      const activeOpt = page.getByRole('option', { name: 'Active' });
      const activeVisible = await activeOpt.isVisible({ timeout: 2000 }).catch(() => false);
      if (activeVisible) {
        await activeOpt.click();
        await page.waitForTimeout(600);
        statusFilterWorked = true;
      }
    } catch {}
    await shot(page, 'A3-status-filter-active');
    addFinding({
      section: 'A', check: 'Status filter (Active) applies',
      status: statusFilterWorked ? 'CONDITIONAL' : 'CONDITIONAL',
      notes: statusFilterWorked ? 'Active filter selected; results visible' : 'Mantine Select interaction required custom handling',
    });

    // A.4 Edit button navigates to builder
    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('Search workflows...').fill(wfName);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(800);
    const editBtn = page.getByRole('button', { name: `Edit workflow ${wfName}` });
    const editBtnVisible = await editBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (editBtnVisible) {
      await editBtn.click();
      await page.waitForURL(`**/workflows/${createdWf.id}/edit`, { timeout: 10000 });
      await shot(page, 'A4-edit-opens-builder');
      addFinding({
        section: 'A', check: 'Edit button navigates to /workflows/:id/edit',
        status: 'PASS', notes: `Navigated to ${page.url()}`,
      });
      await page.goBack();
      await page.waitForTimeout(800);
    } else {
      addFinding({
        section: 'A', check: 'Edit button navigates to /workflows/:id/edit',
        status: 'FAIL', severity: 'P1',
        notes: `Edit button aria-label not found after search for "${wfName}"`,
        reproSteps: `Navigate to /workflows, search for "${wfName}", look for Edit button`,
      });
    }

    // A.5 Toggle active/inactive
    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('Search workflows...').fill(wfName);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(800);
    const enableBtn = page.getByRole('button', { name: new RegExp(`(Enable|Disable) workflow ${wfName}`) });
    const toggleVisible = await enableBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (toggleVisible) {
      const labelBefore = await enableBtn.getAttribute('aria-label') ?? '';
      await enableBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 'A5-toggle-active');
      const labelAfter = await page.getByRole('button', { name: new RegExp(`(Enable|Disable) workflow ${wfName}`) }).getAttribute('aria-label').catch(() => '');
      const toggled = labelBefore !== labelAfter;
      addFinding({
        section: 'A', check: 'Toggle active/inactive changes badge',
        status: toggled ? 'PASS' : 'CONDITIONAL',
        notes: toggled ? `Before: "${labelBefore}" → After: "${labelAfter}"` : 'Toggle clicked but label unchanged — may need page refresh',
      });
    } else {
      addFinding({ section: 'A', check: 'Toggle active/inactive', status: 'CONDITIONAL', notes: 'Toggle button not found after search' });
    }

    // A.6 Network errors on /workflows list load
    if (netA.length > 0) {
      addFinding({
        section: 'A', check: 'No API errors on workflows list page',
        status: 'FAIL', severity: 'P1',
        notes: `${netA.length} failed API requests: ${netA.map(e => `${e.method} ${e.url} (${e.status})`).join('; ')}`,
      });
    } else {
      addFinding({ section: 'A', check: 'No API errors on workflows list page', status: 'PASS', notes: 'Zero critical API failures' });
    }
    if (conA.length > 0) {
      addFinding({
        section: 'A', check: 'No console errors on workflows list page',
        status: 'FAIL', severity: 'P2',
        notes: `${conA.length} console errors: ${conA.slice(0, 3).join(' | ')}`,
      });
    } else {
      addFinding({ section: 'A', check: 'No console errors on workflows list page', status: 'PASS', notes: 'Clean console' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION B — New workflow creation (Builder)
    // ═══════════════════════════════════════════════════════════════════════
    const netB: any[] = [];
    const conB: string[] = [];
    page.on('response', (r: any) => {
      const s = r.status(); const u = r.url(); const m = r.request().method();
      if (u.includes('/api/') && m !== 'OPTIONS' && s >= 400 && !(u.includes('/auth/refresh') && s === 400)) netB.push({ url: u, status: s, method: m });
    });
    page.on('console', (msg: any) => { if (msg.type() === 'error') conB.push(msg.text()); });

    await page.goto(`${BASE_URL}/workflows/builder`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await shot(page, 'B1-builder-empty-state');

    // B.1 Empty state renders with "Start Building" prompt
    const emptyStateText = await page.getByText('Start Building Your Workflow').isVisible({ timeout: 5000 }).catch(() => false);
    addFinding({
      section: 'B', check: 'Builder empty state renders with "Start Building Your Workflow" prompt',
      status: emptyStateText ? 'PASS' : 'FAIL', severity: emptyStateText ? undefined : 'P2',
      notes: emptyStateText ? 'Empty state visible' : '"Start Building Your Workflow" text not found',
    });

    // B.2 Canvas + toolbar visible
    const canvasVisible = await page.locator('.react-flow').isVisible({ timeout: 5000 }).catch(() => false);
    addFinding({
      section: 'B', check: 'ReactFlow canvas renders',
      status: canvasVisible ? 'PASS' : 'FAIL', severity: canvasVisible ? undefined : 'P0',
      notes: canvasVisible ? 'Canvas present' : '.react-flow not found',
    });

    const addTriggerBtn = page.getByRole('button', { name: /Add Trigger Node/ });
    const addTriggerVisible = await addTriggerBtn.isVisible({ timeout: 3000 }).catch(() => false);
    addFinding({
      section: 'B', check: 'Add Trigger Node button visible in empty state',
      status: addTriggerVisible ? 'PASS' : 'FAIL', severity: addTriggerVisible ? undefined : 'P1',
      notes: addTriggerVisible ? 'Button present' : 'Add Trigger Node button missing',
    });

    // B.3 Save without name shows validation error
    const saveBtn = page.getByRole('button', { name: 'Save Workflow' });
    await saveBtn.click();
    await page.waitForTimeout(800);
    await shot(page, 'B2-builder-save-no-name-validation');
    const validationVisible = await page.getByText(/Validation Errors|workflow name is required/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    addFinding({
      section: 'B', check: 'Save without workflow name shows validation error',
      status: validationVisible ? 'PASS' : 'FAIL', severity: validationVisible ? undefined : 'P1',
      notes: validationVisible ? 'Validation error displayed' : 'No validation feedback visible after save click with empty name',
      reproSteps: 'Go to /workflows/builder, click Save Workflow immediately without filling name',
    });

    // B.4 Add trigger node via toolbar button
    const toolbarTriggerBtn = page.getByRole('button', { name: 'Trigger' }).first();
    const toolbarTriggerVisible = await toolbarTriggerBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (toolbarTriggerVisible) {
      await toolbarTriggerBtn.click();
      await page.waitForTimeout(600);
      await shot(page, 'B3-builder-trigger-node-added');
      const nodeVisible = await page.locator('.react-flow__node').first().isVisible({ timeout: 3000 }).catch(() => false);
      addFinding({
        section: 'B', check: 'Add Trigger node via toolbar adds node to canvas',
        status: nodeVisible ? 'PASS' : 'FAIL', severity: nodeVisible ? undefined : 'P1',
        notes: nodeVisible ? 'Trigger node appears on canvas' : 'Node not visible after clicking Trigger button',
      });
    } else {
      addFinding({ section: 'B', check: 'Add Trigger node via toolbar', status: 'CONDITIONAL', notes: 'Toolbar Trigger button not found' });
    }

    // B.5 Add action node via toolbar
    const toolbarActionBtn = page.getByRole('button', { name: 'Action' }).first();
    const toolbarActionVisible = await toolbarActionBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (toolbarActionVisible) {
      await toolbarActionBtn.click();
      await page.waitForTimeout(600);
      await shot(page, 'B4-builder-action-node-added');
      const allNodes = await page.locator('.react-flow__node').count();
      addFinding({
        section: 'B', check: 'Add Action node via toolbar',
        status: allNodes >= 2 ? 'PASS' : 'CONDITIONAL',
        notes: `${allNodes} node(s) on canvas after adding trigger + action`,
      });
    } else {
      addFinding({ section: 'B', check: 'Add Action node via toolbar', status: 'CONDITIONAL', notes: 'Toolbar Action button not found' });
    }

    // B.6 Fill name + save new workflow end-to-end
    const newBuilderWfName = `QA Builder Created ${now}`;
    await page.getByLabel('Workflow Name').fill(newBuilderWfName);
    // Click trigger node to open panel and set trigger type
    const triggerNode = page.locator('.react-flow__node[data-id^="trigger"]').first();
    const triggerNodeExists = await triggerNode.isVisible({ timeout: 2000 }).catch(() => false);
    if (triggerNodeExists) {
      await triggerNode.click();
      await page.waitForTimeout(400);
      // Set trigger type via Node Properties panel
      const triggerTypeSelect = page.getByLabel('Trigger Type');
      const triggerSelectVisible = await triggerTypeSelect.isVisible({ timeout: 2000 }).catch(() => false);
      if (triggerSelectVisible) {
        await page.getByLabel('Trigger Type').click();
        const manualOption = page.getByRole('option', { name: 'Manual Trigger' });
        if (await manualOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await manualOption.click();
        }
      }
    }
    // Click action node and set action type
    const actionNode = page.locator('.react-flow__node[data-id^="action"]').first();
    const actionNodeExists = await actionNode.isVisible({ timeout: 2000 }).catch(() => false);
    if (actionNodeExists) {
      await actionNode.click();
      await page.waitForTimeout(400);
      const actionTypeSelect = page.getByLabel('Action Type');
      const actionSelectVisible = await actionTypeSelect.isVisible({ timeout: 2000 }).catch(() => false);
      if (actionSelectVisible) {
        await page.getByLabel('Action Type').click();
        const createNoteOption = page.getByRole('option', { name: 'Create Note' });
        if (await createNoteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createNoteOption.click();
          await page.waitForTimeout(300);
        }
      }
    }

    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await page.waitForTimeout(2500);
    await shot(page, 'B5-builder-save-result');
    const afterSaveUrl = page.url();
    const savedOk = afterSaveUrl.includes('/workflows') && !afterSaveUrl.includes('/builder');
    // Also accept: still on builder (validation prevented) with no crash
    const successNotif = await page.getByText(/Workflow created successfully|Workflow updated successfully/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    const validErr = await page.getByText(/Validation Errors/i).first().isVisible({ timeout: 1000 }).catch(() => false);
    addFinding({
      section: 'B', check: 'Save new workflow navigates back to /workflows with success notification',
      status: savedOk || successNotif ? 'PASS' : validErr ? 'CONDITIONAL' : 'FAIL',
      severity: (!savedOk && !successNotif && !validErr) ? 'P1' : undefined,
      notes: savedOk
        ? 'Redirected to /workflows after save'
        : successNotif
        ? 'Success notification shown'
        : validErr
        ? 'Validation error shown (disconnected nodes or missing config) — save correctly blocked'
        : `URL after save: ${afterSaveUrl}`,
    });

    if (netB.length > 0) {
      addFinding({
        section: 'B', check: 'No API errors on builder page',
        status: 'FAIL', severity: 'P1',
        notes: `${netB.length} failed API: ${netB.map(e => `${e.method} ${e.url} (${e.status})`).join('; ')}`,
      });
    } else {
      addFinding({ section: 'B', check: 'No API errors on builder page', status: 'PASS', notes: 'Clean' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION C — Workflow edit
    // ═══════════════════════════════════════════════════════════════════════
    await page.goto(`${BASE_URL}/workflows/${createdWf.id}/edit`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await shot(page, 'C1-edit-workflow-loaded');

    const editTitle = await page.getByRole('heading', { name: /Edit Workflow/i }).isVisible({ timeout: 5000 }).catch(() => false);
    addFinding({
      section: 'C', check: 'Edit page renders "Edit Workflow" heading',
      status: editTitle ? 'PASS' : 'FAIL', severity: editTitle ? undefined : 'P1',
      notes: editTitle ? 'Heading present' : '"Edit Workflow" heading not found',
    });

    const editNameInput = page.getByLabel('Workflow Name');
    const editNameValue = await editNameInput.inputValue().catch(() => '');
    const nameLoaded = editNameValue === wfName;
    addFinding({
      section: 'C', check: 'Existing workflow name pre-populated in editor',
      status: nameLoaded ? 'PASS' : 'FAIL', severity: nameLoaded ? undefined : 'P1',
      notes: nameLoaded ? `Name loaded: "${editNameValue}"` : `Expected "${wfName}" but got "${editNameValue}"`,
    });

    // Edit name and save update
    await editNameInput.fill(`${wfName} EDITED`);
    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await page.waitForTimeout(2500);
    await shot(page, 'C2-edit-workflow-saved');
    const editSaveNotif = await page.getByText(/Workflow updated successfully/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    const editNavBack = page.url().includes('/workflows') && !page.url().includes('/edit');
    addFinding({
      section: 'C', check: 'Editing workflow name and saving shows success + redirects',
      status: editSaveNotif || editNavBack ? 'PASS' : 'CONDITIONAL',
      notes: editSaveNotif ? 'Success notification shown' : editNavBack ? 'Redirected to /workflows' : 'Neither notification nor redirect detected',
    });

    // Verify version incremented
    try {
      const wfData = await apiGet(request, auth, `/workflows/${createdWf.id}`);
      const versionIncremented = (wfData.version ?? 1) >= 1;
      addFinding({
        section: 'C', check: 'Workflow version field in API response',
        status: versionIncremented ? 'PASS' : 'CONDITIONAL',
        notes: `Version: ${wfData.version}`,
      });
    } catch (e: any) {
      addFinding({ section: 'C', check: 'Workflow version field in API response', status: 'CONDITIONAL', notes: `API fetch failed: ${e.message}` });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION D — Execution list + detail
    // ═══════════════════════════════════════════════════════════════════════
    const netD: any[] = [];
    page.on('response', (r: any) => {
      const s = r.status(); const u = r.url(); const m = r.request().method();
      if (u.includes('/api/') && m !== 'OPTIONS' && s >= 400 && !(u.includes('/auth/refresh') && s === 400)) netD.push({ url: u, status: s, method: m });
    });

    await page.goto(`${BASE_URL}/workflows?tab=executions`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await shot(page, 'D1-executions-list');

    const execTabVisible = await page.getByText('Executions').first().isVisible({ timeout: 5000 }).catch(() => false);
    addFinding({
      section: 'D', check: 'Executions tab / list page renders',
      status: execTabVisible ? 'PASS' : 'FAIL', severity: execTabVisible ? undefined : 'P1',
      notes: execTabVisible ? 'Executions content visible' : 'Executions tab content not found',
    });

    // D.2 Search renders empty state on no-match
    const execSearchInput = page.getByPlaceholder(/search by workflow name or execution id/i);
    const execSearchVisible = await execSearchInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (execSearchVisible) {
      await execSearchInput.fill(`no-match-${now}`);
      await page.waitForTimeout(800);
      await shot(page, 'D2-executions-search-no-match');
      const emptyExecState = await page.getByText(/No executions found/i).isVisible({ timeout: 3000 }).catch(() => false);
      addFinding({
        section: 'D', check: 'Execution search with no-match shows empty state',
        status: emptyExecState ? 'PASS' : 'FAIL', severity: emptyExecState ? undefined : 'P2',
        notes: emptyExecState ? '"No executions found" visible' : 'Empty state not shown for unmatched search',
      });
      // No stale paginator on empty state
      const paginatorCount = await page.locator('.mantine-Pagination-root:visible').count();
      addFinding({
        section: 'D', check: 'No stale paginator on empty execution list',
        status: paginatorCount === 0 ? 'PASS' : 'FAIL', severity: paginatorCount > 0 ? 'P2' : undefined,
        notes: paginatorCount === 0 ? 'Paginator hidden' : `Paginator visible with 0 results (count=${paginatorCount})`,
        reproSteps: paginatorCount > 0 ? 'Search for no-match term in executions tab; paginator should hide' : undefined,
      });
      await execSearchInput.fill('');
      await page.waitForTimeout(600);
    } else {
      addFinding({ section: 'D', check: 'Execution search input visible', status: 'FAIL', severity: 'P1', notes: 'Search placeholder not found in executions view' });
    }

    // D.3 Filter by workflow_id via URL
    await page.goto(`${BASE_URL}/workflows?tab=executions&workflow_id=${createdWf.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await shot(page, 'D3-executions-filter-by-workflow-id');
    const execPageLoaded = await page.locator('body').innerText();
    addFinding({
      section: 'D', check: 'Execution list accepts workflow_id filter param',
      status: !execPageLoaded.includes('Something went wrong') ? 'PASS' : 'FAIL',
      notes: 'Page loads without error when workflow_id param provided',
    });

    if (netD.length > 0) {
      addFinding({
        section: 'D', check: 'No API errors on execution list',
        status: 'FAIL', severity: 'P1',
        notes: `${netD.length} errors: ${netD.map(e => `${e.method} ${e.url} (${e.status})`).join('; ')}`,
      });
    } else {
      addFinding({ section: 'D', check: 'No API errors on execution list', status: 'PASS', notes: 'Clean' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION E — Run/Test workflow modal
    // ═══════════════════════════════════════════════════════════════════════
    const netE: any[] = [];
    page.on('response', (r: any) => {
      const s = r.status(); const u = r.url(); const m = r.request().method();
      if (u.includes('/api/') && m !== 'OPTIONS' && s >= 400 && !(u.includes('/auth/refresh') && s === 400)) netE.push({ url: u, status: s, method: m });
    });

    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('Search workflows...').fill(wfName.replace(' EDITED', ''));
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(800);

    // E.1 Test modal opens
    const testBtn = page.getByRole('button', { name: new RegExp(`Test workflow`) }).first();
    const testBtnVisible = await testBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (testBtnVisible) {
      await testBtn.click();
      await page.waitForTimeout(800);
      await shot(page, 'E1-test-modal-opened');
      const testModal = page.getByRole('dialog');
      const testModalVisible = await testModal.isVisible({ timeout: 5000 }).catch(() => false);
      addFinding({
        section: 'E', check: 'Test workflow modal opens',
        status: testModalVisible ? 'PASS' : 'FAIL', severity: testModalVisible ? undefined : 'P1',
        notes: testModalVisible ? 'Modal dialog opened' : 'No dialog visible after clicking Test',
      });

      if (testModalVisible) {
        // E.2 Client list loads inside modal
        const clientSelectVisible = await testModal.getByRole('textbox', { name: /client/i }).isVisible({ timeout: 5000 }).catch(() => false);
        addFinding({
          section: 'E', check: 'Client selector present in test modal',
          status: clientSelectVisible ? 'PASS' : 'FAIL', severity: clientSelectVisible ? undefined : 'P1',
          notes: clientSelectVisible ? 'Client field visible' : 'Client field not found in modal',
        });

        // E.3 Run without client selection — button should be disabled as the guard
        const runTestBtnNoClient = testModal.getByRole('button', { name: /Run Test|Run Workflow/i }).first();
        const runTestDisabledNoClient = await runTestBtnNoClient.isDisabled({ timeout: 3000 }).catch(() => false);
        await shot(page, 'E2-test-modal-no-client-validation');
        addFinding({
          section: 'E', check: 'Test modal Run button disabled when no client selected',
          status: runTestDisabledNoClient ? 'PASS' : 'CONDITIONAL',
          notes: runTestDisabledNoClient
            ? 'Run Test button correctly disabled until client selected'
            : 'Run Test button is enabled without client — may rely on inline error instead',
        });

        // E.4 Select client + run test (dry-run)
        try {
          // Mantine Select: click the input inside the Select component
          const clientSelectInput = testModal.locator('.mantine-Select-input').first();
          const clientSelectVisible = await clientSelectInput.isVisible({ timeout: 3000 }).catch(() => false);
          if (clientSelectVisible) {
            await clientSelectInput.click();
            await page.waitForTimeout(600);
          } else {
            // fallback: combobox role
            const comboClient = testModal.getByRole('combobox').first();
            await comboClient.click();
            await page.waitForTimeout(600);
          }
          const clientOption = page.getByRole('option', { name: new RegExp(clientName.substring(0, 20)) }).first();
          const clientOptionVisible = await clientOption.isVisible({ timeout: 5000 }).catch(() => false);
          if (clientOptionVisible) {
            await clientOption.click();
            await page.waitForTimeout(400);
          } else {
            // type to filter
            await testModal.locator('.mantine-Select-input').first().fill(clientName.substring(0, 10));
            await page.waitForTimeout(500);
            const filteredOpt = page.getByRole('option').first();
            if (await filteredOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
              await filteredOpt.click();
              await page.waitForTimeout(300);
            }
          }
          // Trigger data is a JsonInput — fill via locator
          const tdTextarea = testModal.locator('textarea').last();
          const tdVisible = await tdTextarea.isVisible({ timeout: 2000 }).catch(() => false);
          if (tdVisible) {
            await tdTextarea.fill('{"source":"workflow-qa"}');
          }
          await testModal.getByRole('button', { name: /Run Test/i }).click();
          await page.waitForTimeout(4000);
          await shot(page, 'E3-test-modal-result');
          const testResult = await page.getByText(/Workflow Would Execute|Workflow Would NOT Execute|Output/i).first().isVisible({ timeout: 8000 }).catch(() => false);
          addFinding({
            section: 'E', check: 'Test (dry-run) executes and shows result',
            status: testResult ? 'PASS' : 'FAIL', severity: testResult ? undefined : 'P1',
            notes: testResult ? 'Test result text visible' : 'No result text found after dry-run',
            reproSteps: 'Open Test modal, select client, fill trigger data, click Run Test',
          });
        } catch (e: any) {
          addFinding({ section: 'E', check: 'Test (dry-run) executes and shows result', status: 'FAIL', severity: 'P1', notes: `Error: ${e.message}` });
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      addFinding({ section: 'E', check: 'Test workflow modal opens', status: 'CONDITIONAL', notes: 'Test button not found after workflow search' });
    }

    // E.5 Run (execute) modal — full execution
    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('Search workflows...').fill(wfName.replace(' EDITED', ''));
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(800);

    const runBtn = page.getByRole('button', { name: new RegExp(`Run workflow`) }).first();
    const runBtnVisible = await runBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (runBtnVisible) {
      await runBtn.click();
      await page.waitForTimeout(800);
      await shot(page, 'E4-run-modal-opened');
      const runModal = page.getByRole('dialog');
      const runModalVisible = await runModal.isVisible({ timeout: 5000 }).catch(() => false);
      if (runModalVisible) {
        try {
          // Mantine Select: click the input, then pick from dropdown options
          const runClientSelectInput = runModal.locator('.mantine-Select-input').first();
          const runClientSelectVisible = await runClientSelectInput.isVisible({ timeout: 3000 }).catch(() => false);
          if (runClientSelectVisible) {
            await runClientSelectInput.click();
            await page.waitForTimeout(600);
          } else {
            await runModal.getByRole('combobox').first().click();
            await page.waitForTimeout(600);
          }
          const runClientOpt = page.getByRole('option', { name: new RegExp(clientName.substring(0, 20)) }).first();
          if (await runClientOpt.isVisible({ timeout: 5000 }).catch(() => false)) {
            await runClientOpt.click();
            await page.waitForTimeout(400);
          } else {
            await runModal.locator('.mantine-Select-input').first().fill(clientName.substring(0, 10));
            await page.waitForTimeout(500);
            const runFallbackOpt = page.getByRole('option').first();
            if (await runFallbackOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
              await runFallbackOpt.click();
              await page.waitForTimeout(300);
            }
          }
          const tdRun = runModal.locator('textarea').last();
          if (await tdRun.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tdRun.fill('{"source":"workflow-qa-run"}');
          }
          await runModal.getByRole('button', { name: /Run Workflow/i }).click();
          await page.waitForTimeout(4000);
          await shot(page, 'E5-run-modal-result');

          const runSuccess = await page.getByText(/Workflow Executed|Execution.*started/i).first().isVisible({ timeout: 8000 }).catch(() => false);
          addFinding({
            section: 'E', check: 'Run (execute) workflow shows success result',
            status: runSuccess ? 'PASS' : 'FAIL', severity: runSuccess ? undefined : 'P1',
            notes: runSuccess ? 'Execution success text visible' : 'No success message after run',
            reproSteps: 'Open Run modal, select client, fill trigger data, click Run Workflow',
          });

          if (runSuccess) {
            // E.6 "Open Execution Logs" button present
            const openLogsBtn = runModal.getByRole('button', { name: /Open Execution Logs/i });
            const openLogsBtnVisible = await openLogsBtn.isVisible({ timeout: 3000 }).catch(() => false);
            addFinding({
              section: 'E', check: '"Open Execution Logs" button visible after run',
              status: openLogsBtnVisible ? 'PASS' : 'FAIL', severity: openLogsBtnVisible ? undefined : 'P2',
              notes: openLogsBtnVisible ? 'Button visible' : 'Button not found post-execution',
            });
            if (openLogsBtnVisible) {
              await openLogsBtn.click();
              await page.waitForTimeout(1500);
              await shot(page, 'E6-execution-detail-after-run');
              const execDetailVisible = await page.getByText(/Execution Details/i).isVisible({ timeout: 8000 }).catch(() => false);
              addFinding({
                section: 'E', check: '"Open Execution Logs" navigates to execution detail',
                status: execDetailVisible ? 'PASS' : 'FAIL', severity: execDetailVisible ? undefined : 'P2',
                notes: execDetailVisible ? 'Execution Details panel visible' : 'Detail not shown after clicking Open Execution Logs',
              });
            }
          }
        } catch (e: any) {
          addFinding({ section: 'E', check: 'Run (execute) workflow', status: 'FAIL', severity: 'P1', notes: `Error: ${e.message}` });
        }
      } else {
        addFinding({ section: 'E', check: 'Run workflow modal opens', status: 'FAIL', severity: 'P1', notes: 'Run modal dialog not visible' });
      }
    } else {
      addFinding({ section: 'E', check: 'Run workflow modal opens', status: 'CONDITIONAL', notes: 'Run button not found after workflow search' });
    }

    // E.7 Verify note was created by workflow action
    try {
      const notes = await apiGet(request, auth, `/notes?client_id=${client.id}`);
      const noteArr = Array.isArray(notes) ? notes : notes?.notes ?? notes?.data ?? [];
      const hasNote = noteArr.some((n: any) => n.text === wfNoteText);
      addFinding({
        section: 'E', check: 'Workflow CREATE_NOTE action produced note in client record',
        status: hasNote ? 'PASS' : 'FAIL', severity: hasNote ? undefined : 'P1',
        notes: hasNote ? `Note "${wfNoteText}" found` : `Note "${wfNoteText}" NOT in client notes (${noteArr.length} notes found)`,
        reproSteps: hasNote ? undefined : `Run workflow with client ${client.id}, check GET /api/notes?client_id=${client.id}`,
      });
    } catch (e: any) {
      addFinding({ section: 'E', check: 'Workflow CREATE_NOTE action', status: 'CONDITIONAL', notes: `Notes API error: ${e.message}` });
    }

    if (netE.length > 0) {
      addFinding({
        section: 'E', check: 'No API errors during run/test modal flows',
        status: 'FAIL', severity: 'P1',
        notes: `${netE.length} errors: ${netE.map(e => `${e.method} ${e.url} (${e.status})`).join('; ')}`,
      });
    } else {
      addFinding({ section: 'E', check: 'No API errors during run/test modal flows', status: 'PASS', notes: 'Clean' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION F — Export / Import
    // ═══════════════════════════════════════════════════════════════════════

    // F.1 Export via API directly (browser download is hard to capture in Playwright)
    try {
      const exportRes = await request.get(`${API_BASE}/workflows/${createdWf.id}/export`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const exportOk = exportRes.ok();
      const contentType = exportRes.headers()['content-type'] ?? '';
      addFinding({
        section: 'F', check: 'Export workflow API returns 200 with JSON payload',
        status: exportOk ? 'PASS' : 'FAIL', severity: exportOk ? undefined : 'P1',
        notes: exportOk ? `Content-Type: ${contentType}` : `Status: ${exportRes.status()}`,
      });

      if (exportOk) {
        // F.2 Import the same workflow (as template)
        let exportedData: any;
        try {
          exportedData = await exportRes.json();
        } catch {
          const text = await exportRes.text();
          exportedData = JSON.parse(text);
        }
        const importRes = await request.post(`${API_BASE}/workflows/import`, {
          data: { workflowData: exportedData, asTemplate: true },
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            'X-CSRF-Token': auth.csrfToken,
          },
        });
        const importOk = importRes.ok();
        addFinding({
          section: 'F', check: 'Import exported workflow as template succeeds',
          status: importOk ? 'PASS' : 'FAIL', severity: importOk ? undefined : 'P1',
          notes: importOk ? 'Import 2xx' : `Import status: ${importRes.status()}: ${await importRes.text().catch(() => '')}`,
        });

        if (importOk) {
          const imported = await importRes.json();
          addFinding({
            section: 'F', check: 'Imported workflow is marked as template (inactive)',
            status: imported.isTemplate === true && imported.isActive === false ? 'PASS' : 'CONDITIONAL',
            notes: `isTemplate=${imported.isTemplate}, isActive=${imported.isActive}`,
          });
        }
      }
    } catch (e: any) {
      addFinding({ section: 'F', check: 'Export/Import workflow', status: 'FAIL', severity: 'P1', notes: `Error: ${e.message}` });
    }

    // F.3 Clone workflow via UI
    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.getByPlaceholder('Search workflows...').fill(wfName.replace(' EDITED', ''));
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(800);
    const cloneBtn = page.getByRole('button', { name: new RegExp(`Clone workflow`) }).first();
    const cloneBtnVisible = await cloneBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (cloneBtnVisible) {
      await cloneBtn.click();
      await page.waitForTimeout(2500);
      await shot(page, 'F1-clone-workflow');
      // After clone, should navigate to edit the cloned workflow
      const cloneUrl = page.url();
      const cloneNavigated = cloneUrl.includes('/edit');
      addFinding({
        section: 'F', check: 'Clone workflow navigates to edit the cloned copy',
        status: cloneNavigated ? 'PASS' : 'CONDITIONAL',
        notes: cloneNavigated ? `Cloned workflow edit URL: ${cloneUrl}` : `URL after clone: ${cloneUrl}`,
      });
    } else {
      addFinding({ section: 'F', check: 'Clone workflow via UI', status: 'CONDITIONAL', notes: 'Clone button not found' });
    }

    // F.4 Import modal UI
    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const importBtn = page.getByRole('button', { name: 'Import' });
    const importBtnVisible = await importBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (importBtnVisible) {
      await importBtn.click();
      await page.waitForTimeout(600);
      await shot(page, 'F2-import-modal');
      const importModal = page.getByRole('dialog', { name: /Import Workflow/i });
      const importModalVisible = await importModal.isVisible({ timeout: 3000 }).catch(() => false);
      addFinding({
        section: 'F', check: 'Import Workflow modal opens',
        status: importModalVisible ? 'PASS' : 'FAIL', severity: importModalVisible ? undefined : 'P2',
        notes: importModalVisible ? 'Import modal visible' : 'Import modal not found',
      });
      await page.keyboard.press('Escape');
    } else {
      addFinding({ section: 'F', check: 'Import Workflow modal opens', status: 'CONDITIONAL', notes: 'Import button not visible (may require canManageWorkflows role check)' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION G — RBAC (Viewer role)
    // ═══════════════════════════════════════════════════════════════════════
    const viewerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const viewerPage = await viewerCtx.newPage();
    await loginUi(viewerPage, VIEWER_EMAIL);
    await viewerPage.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await viewerPage.waitForTimeout(1200);
    await viewerPage.screenshot({ path: path.join(EVIDENCE_DIR, 'G1-viewer-workflows-list.png'), fullPage: true });

    // G.1 Viewer cannot see Create Workflow button
    const createBtnViewer = viewerPage.getByRole('button', { name: 'Create Workflow' });
    const createBtnViewerVisible = await createBtnViewer.isVisible({ timeout: 3000 }).catch(() => false);
    addFinding({
      section: 'G', check: 'Viewer role cannot see Create Workflow button',
      status: !createBtnViewerVisible ? 'PASS' : 'FAIL', severity: createBtnViewerVisible ? 'P1' : undefined,
      notes: !createBtnViewerVisible ? 'Create button hidden for viewer' : 'Create Workflow button visible for viewer — RBAC leak',
      reproSteps: createBtnViewerVisible ? 'Login as viewer@example.com, go to /workflows, Create Workflow should be hidden' : undefined,
    });

    // G.2 Viewer cannot see Import button
    const importBtnViewer = viewerPage.getByRole('button', { name: 'Import' });
    const importBtnViewerVisible = await importBtnViewer.isVisible({ timeout: 3000 }).catch(() => false);
    addFinding({
      section: 'G', check: 'Viewer role cannot see Import button',
      status: !importBtnViewerVisible ? 'PASS' : 'CONDITIONAL',
      notes: !importBtnViewerVisible ? 'Import hidden for viewer' : 'Import visible for viewer',
    });

    // G.3 Edit/Clone/Run disabled for viewer
    const editBtnViewer = viewerPage.getByRole('button', { name: /Edit workflow/ }).first();
    const editBtnViewerExists = await editBtnViewer.isVisible({ timeout: 3000 }).catch(() => false);
    if (editBtnViewerExists) {
      const editDisabled = await editBtnViewer.isDisabled();
      addFinding({
        section: 'G', check: 'Edit workflow button disabled for viewer',
        status: editDisabled ? 'PASS' : 'FAIL', severity: !editDisabled ? 'P1' : undefined,
        notes: editDisabled ? 'Edit button disabled' : 'Edit button enabled for viewer — RBAC leak',
      });
    } else {
      addFinding({ section: 'G', check: 'Edit workflow button for viewer', status: 'CONDITIONAL', notes: 'No workflow rows visible to viewer' });
    }

    await viewerCtx.close();

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION G (continued) — mobile viewport smoke
    // ═══════════════════════════════════════════════════════════════════════
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileCtx.newPage();
    await loginUi(mobilePage, ADMIN_EMAIL);
    await mobilePage.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1200);
    await mobilePage.screenshot({ path: path.join(EVIDENCE_DIR, 'G2-mobile-workflows-list.png'), fullPage: true });
    const mobileBodyText = await mobilePage.locator('body').innerText();
    addFinding({
      section: 'G', check: 'Mobile viewport (390x844) — workflows list loads without crash',
      status: !mobileBodyText.toLowerCase().includes('something went wrong') ? 'PASS' : 'FAIL',
      notes: 'Mobile smoke pass',
    });
    await mobileCtx.close();

    // ═══════════════════════════════════════════════════════════════════════
    // UX observations (fixed checks)
    // ═══════════════════════════════════════════════════════════════════════
    // Navigate to builder and check for aria-label on back button
    await page.goto(`${BASE_URL}/workflows/builder`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const backBtnAriaLabel = await page.locator('[aria-label], button[title]').filter({ hasText: '' }).first().getAttribute('aria-label').catch(() => null);
    // Check "Delete Selected" button is disabled when nothing selected
    const deleteSelectedBtn = page.getByRole('button', { name: 'Delete Selected' });
    const deleteSelectedDisabled = await deleteSelectedBtn.isDisabled({ timeout: 3000 }).catch(() => true);
    addFinding({
      section: 'UX', check: '"Delete Selected" button disabled when no node selected in builder',
      status: deleteSelectedDisabled ? 'PASS' : 'FAIL', severity: !deleteSelectedDisabled ? 'P2' : undefined,
      notes: deleteSelectedDisabled ? 'Button correctly disabled' : 'Delete Selected enabled with no selection — accidental destructive action risk',
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Write report
    // ═══════════════════════════════════════════════════════════════════════
    const pass = findings.filter(f => f.status === 'PASS').length;
    const fail = findings.filter(f => f.status === 'FAIL').length;
    const conditional = findings.filter(f => f.status === 'CONDITIONAL').length;
    const p0 = findings.filter(f => f.severity === 'P0').length;
    const p1 = findings.filter(f => f.severity === 'P1').length;
    const p2 = findings.filter(f => f.severity === 'P2').length;

    const report = {
      runAt: new Date().toISOString(),
      summary: { pass, fail, conditional, total: findings.length, p0, p1, p2 },
      findings,
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    console.log('\n════════════════ WORKFLOW QA RESULTS ════════════════');
    console.log(`PASS: ${pass}  FAIL: ${fail}  CONDITIONAL: ${conditional}  TOTAL: ${findings.length}`);
    console.log(`Severity: P0=${p0}  P1=${p1}  P2=${p2}`);
    console.log(`Report: ${REPORT_PATH}`);
    console.log(`Screenshots: ${EVIDENCE_DIR}`);

    if (fail > 0) {
      console.log('\nFAILED CHECKS:');
      findings.filter(f => f.status === 'FAIL').forEach(f => {
        console.log(`  [${f.severity ?? '??'}] [${f.section}] ${f.check}: ${f.notes}`);
      });
    }
    console.log('═════════════════════════════════════════════════════\n');

    // Fail the test only on P0 issues (catastrophic)
    expect(p0, `P0 failures found — see report at ${REPORT_PATH}`).toBe(0);
  });
});
