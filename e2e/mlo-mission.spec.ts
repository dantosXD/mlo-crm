import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { passAFlows, passBFlows, passCFlows } from './helpers/flowCatalog';
import { MissionRecorder } from './helpers/missionRecorder';
import { startNetworkObserver } from './helpers/networkMetrics';
import { captureScreenPerformance } from './helpers/perfMetrics';
import { selectQuickWins, sortIssuesByPriority, withComputedScoring } from './helpers/issueScoring';
import type { FlowDefinition, IssueCategory, IssueRecord, IssueSeverity, MissionPass } from './helpers/missionTypes';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:3002/api';
const PASSWORD = 'password123';

test.use({ viewport: { width: 1440, height: 900 } });

type AuthSession = {
  accessToken: string;
  csrfToken: string;
  user: { id: string; email: string; role: string; name: string };
};

type MissionUser = { id: string; email: string; password: string };
type MissionClient = { id: string; name: string; email: string; phone: string };
type FlowTelemetry = { stepCount: number; retries: number; backtracks: number; frictionPoints: string[]; suggestedShortcuts: string[] };
type Observer = ReturnType<typeof startNetworkObserver>;
type ReadOnlyRole = 'VIEWER' | 'PROCESSOR' | 'UNDERWRITER';

function runId(): string {
  return `mlo-mission-${new Date().toISOString().replace(/[.:]/g, '-')}`;
}

function rel(p: string): string {
  return path.relative(path.resolve('.'), p).replace(/\\/g, '/');
}

function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function sh(args: string[], timeout = 25 * 60 * 1000): string {
  const out = spawnSync(process.execPath, args, {
    cwd: path.resolve('.'),
    env: process.env,
    encoding: 'utf-8',
    timeout,
  });
  if (out.status !== 0) {
    throw new Error(`${args.join(' ')} failed\n${out.stdout}\n${out.stderr}`);
  }
  return out.stdout;
}

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function loginUi(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  let emailInput = page.getByTestId('email-input');
  let passwordInput = page.getByTestId('password-input');
  let signInButton = page.getByTestId('sign-in-button');

  const hasTestIds = await emailInput.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!hasTestIds) {
    emailInput = page.getByLabel('Email');
    passwordInput = page.getByLabel('Password');
    signInButton = page.getByRole('button', { name: /sign in/i });
  }

  const hasLoginForm = await emailInput.isVisible({ timeout: 2_000 }).catch(() => false);
  if (!hasLoginForm) {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    return;
  }

  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(email, { timeout: 10_000 });
  await passwordInput.fill(password, { timeout: 10_000 });
  await signInButton.click({ timeout: 10_000 });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function isAccessDenied(page: Page, timeoutMs = 12_000): Promise<boolean> {
  try {
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function loginApi(request: APIRequestContext, email: string, password = PASSWORD): Promise<AuthSession> {
  const login = await request.post(`${API_BASE_URL}/auth/login`, { data: { email, password } });
  expect(login.ok(), `login failed: ${email}`).toBeTruthy();
  const data = await login.json();
  const me = await request.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${data.accessToken}` },
  });
  return {
    accessToken: data.accessToken,
    csrfToken: me.headers()['x-csrf-token'] ?? '',
    user: data.user,
  };
}

async function apiJson(
  request: APIRequestContext,
  auth: AuthSession,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  payload?: unknown
): Promise<any> {
  const res = await request.fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    data: payload,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      ...(auth.csrfToken ? { 'X-CSRF-Token': auth.csrfToken } : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`${method} ${endpoint} failed (${res.status()}): ${await res.text()}`);
  }
  if (res.status() === 204) return null;
  return res.json();
}

async function ensureMissionUser(request: APIRequestContext, id: string): Promise<MissionUser> {
  const admin = await loginApi(request, 'admin@example.com');
  const suffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toLowerCase();
  const email = `mission-${suffix}@example.com`;
  const user = await apiJson(request, admin, 'POST', '/users', {
    email,
    password: PASSWORD,
    name: `Mission ${suffix}`,
    role: 'MLO',
  });
  return { id: user.id, email, password: PASSWORD };
}

async function ensureRoleUser(
  request: APIRequestContext,
  id: string,
  role: ReadOnlyRole
): Promise<MissionUser> {
  const admin = await loginApi(request, 'admin@example.com');
  const suffix = id.replace(/[^a-zA-Z0-9]/g, '').slice(-10).toLowerCase();
  const roleSlug = role.toLowerCase();
  const email = `mission-${roleSlug}-${suffix}@example.com`;

  try {
    await apiJson(request, admin, 'POST', '/users', {
      email,
      password: PASSWORD,
      name: `Mission ${role} ${suffix}`,
      role,
    });
  } catch {
    // If this run is retried with the same run id, user creation may already exist.
  }

  const verified = await loginApi(request, email, PASSWORD);
  return { id: verified.user.id, email, password: PASSWORD };
}

function flowState(): FlowTelemetry {
  return { stepCount: 0, retries: 0, backtracks: 0, frictionPoints: [], suggestedShortcuts: [] };
}

async function runFlow(
  recorder: MissionRecorder,
  obs: Observer,
  flow: FlowDefinition,
  fn: (state: FlowTelemetry) => Promise<void>
): Promise<void> {
  const state = flowState();
  const start = new Date();
  const from = obs.getSamples().length;
  let status: 'PASS' | 'FAIL' = 'PASS';
  try {
    await fn(state);
  } catch (e) {
    status = 'FAIL';
    state.frictionPoints.push(`Flow error: ${e instanceof Error ? e.message : String(e)}`);
  }
  const end = new Date();
  const failed = obs.getSamples().slice(from).filter((s) => !s.ok).length;
  recorder.addFlow({
    runId: recorder.runId,
    pass: flow.pass,
    flowId: flow.id,
    title: flow.title,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    durationMs: end.getTime() - start.getTime(),
    stepCount: state.stepCount,
    retries: state.retries,
    backtracks: state.backtracks,
    failedRequests: failed,
    frictionPoints: state.frictionPoints,
    suggestedShortcuts: state.suggestedShortcuts,
    status,
  });
}

async function screenshot(page: Page, recorder: MissionRecorder, name: string): Promise<string> {
  const p = path.join(recorder.evidenceDir, `${slug(name)}-${Date.now()}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return rel(p);
}

async function createClient(page: Page, c: Omit<MissionClient, 'id'>): Promise<string> {
  await page.goto(`${BASE_URL}/clients`);
  await page.getByRole('button', { name: 'Add Client' }).first().click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Name').fill(c.name);
  await d.getByLabel('Email').fill(c.email);
  await d.getByLabel('Phone').fill(c.phone);
  await d.getByRole('button', { name: 'Create Client' }).click();
  await expect(page.getByText(c.name).first()).toBeVisible({ timeout: 20_000 });
  await page.getByLabel(`View details for ${c.name}`).first().click();
  await expect(page).toHaveURL(/\/clients\/[a-zA-Z0-9-]+/);
  const m = /\/clients\/([^/?]+)/.exec(page.url());
  if (!m?.[1]) throw new Error(`no id for ${c.name}`);
  return m[1];
}

async function perf(recorder: MissionRecorder, page: Page, pass: MissionPass, flowId: string, screen: string): Promise<void> {
  recorder.addScreenPerf(await captureScreenPerformance(page, { runId: recorder.runId, pass, flowId, screen }));
}

async function clientTab(page: Page, clientId: string, tab: string): Promise<void> {
  await page.goto(`${BASE_URL}/clients/${clientId}?tab=${tab}`);
  await page.waitForLoadState('domcontentloaded');
}

async function dragClientToStage(page: Page, clientName: string, stageKey: string): Promise<void> {
  const card = page.locator(`.pipeline-card:has-text("${clientName}")`).first();
  const stage = page.locator(`[data-stage="${stageKey}"]`).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(stage).toBeVisible({ timeout: 20_000 });

  const cardBox = await card.boundingBox();
  const stageBox = await stage.boundingBox();
  if (!cardBox || !stageBox) {
    throw new Error(`Unable to calculate drag bounds for ${clientName} -> ${stageKey}`);
  }

  const startX = cardBox.x + Math.min(20, cardBox.width / 2);
  const startY = cardBox.y + Math.min(20, cardBox.height / 2);
  const endX = stageBox.x + stageBox.width / 2;
  const endY = stageBox.y + 60;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 18 });
  await page.mouse.up();
}

function counts(issues: IssueRecord[]): Record<IssueSeverity, number> {
  return {
    P0: issues.filter((i) => i.severity === 'P0').length,
    P1: issues.filter((i) => i.severity === 'P1').length,
    P2: issues.filter((i) => i.severity === 'P2').length,
    P3: issues.filter((i) => i.severity === 'P3').length,
  };
}

async function missionContext(browser: Browser, recorder: MissionRecorder): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordHar: { path: path.join(recorder.evidenceDir, 'mission.har'), content: 'omit' },
    recordVideo: { dir: recorder.evidenceDir, size: { width: 1440, height: 900 } },
  });
  return context;
}

test('MLO break-it mission run', async ({ browser, request }) => {
  test.setTimeout(120 * 60 * 1000);

  const id = process.env.MLO_MISSION_RUN_ID ?? runId();
  const recorder = new MissionRecorder(id);
  const context = await missionContext(browser, recorder);
  const page = await context.newPage();
  const obs = startNetworkObserver(page);

  const startIso = new Date().toISOString();
  const noteLog: string[] = [];
  const seedRuns: string[] = [];
  const issues: IssueRecord[] = [];
  const clients: MissionClient[] = [];
  const base = {
    device: 'Desktop',
    os: `${os.platform()} ${os.release()}`,
    browser: 'chromium',
    appVersion: process.env.npm_package_version ?? 'local',
    build: 'local-dev',
  };

  let issueN = 0;
  const logIssue = async (x: {
    pass: MissionPass;
    flowId: string;
    role: string;
    title: string;
    category: IssueCategory;
    severity: IssueSeverity;
    steps: string[];
    expected: string;
    actual: string;
    impact: string;
    suggestedFix: string;
    score: { frequency: number; pain: number; risk: number; effort: number };
    shot: string;
    network?: string;
  }) => {
    issueN += 1;
    const shot = await screenshot(page, recorder, x.shot);
    const item: IssueRecord = {
      id: `ISSUE-${String(issueN).padStart(3, '0')}`,
      runId: id,
      pass: x.pass,
      flowId: x.flowId,
      issueTitle: x.title,
      category: x.category,
      environment: {
        ...base,
        role: x.role,
        networkProfile: x.network ?? 'default',
        url: page.url(),
      },
      stepsToReproduce: x.steps,
      expected: x.expected,
      actual: x.actual,
      impact: x.impact,
      severity: x.severity,
      evidence: {
        screenshots: [shot],
        harFile: rel(path.join(recorder.evidenceDir, 'mission.har')),
        logs: [rel(recorder.consoleLogPath)],
        timestamps: [new Date().toISOString()],
      },
      suggestedFix: x.suggestedFix,
      extraNotes: '',
      scoring: withComputedScoring(x.score),
      createdAt: new Date().toISOString(),
    };
    issues.push(item);
    recorder.addIssue(item);
  };

  const logDerivedIssue = (x: {
    pass: MissionPass;
    flowId: string;
    role: string;
    title: string;
    category: IssueCategory;
    severity: IssueSeverity;
    steps: string[];
    expected: string;
    actual: string;
    impact: string;
    suggestedFix: string;
    score: { frequency: number; pain: number; risk: number; effort: number };
    extraNotes?: string;
  }) => {
    issueN += 1;
    const item: IssueRecord = {
      id: `ISSUE-${String(issueN).padStart(3, '0')}`,
      runId: id,
      pass: x.pass,
      flowId: x.flowId,
      issueTitle: x.title,
      category: x.category,
      environment: {
        ...base,
        role: x.role,
        networkProfile: 'default',
        url: page.url(),
      },
      stepsToReproduce: x.steps,
      expected: x.expected,
      actual: x.actual,
      impact: x.impact,
      severity: x.severity,
      evidence: {
        screenshots: [],
        harFile: rel(path.join(recorder.evidenceDir, 'mission.har')),
        logs: [rel(recorder.consoleLogPath)],
        timestamps: [new Date().toISOString()],
      },
      suggestedFix: x.suggestedFix,
      extraNotes: x.extraNotes || '',
      scoring: withComputedScoring(x.score),
      createdAt: new Date().toISOString(),
    };
    issues.push(item);
    recorder.addIssue(item);
  };

  page.on('console', (m) => recorder.addConsoleLine(`[console:${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => recorder.addConsoleLine(`[pageerror] ${e.message}`));

  let missionUser: MissionUser | null = null;
  let missionAuth: AuthSession | null = null;
  let readOnlyUsers: Array<{ role: ReadOnlyRole; email: string }> = [];
  const ts = Date.now();
  let opTask = '';
  let opNote = '';

  try {
    missionUser = await ensureMissionUser(request, id);
    missionAuth = await loginApi(request, missionUser.email, missionUser.password);
    readOnlyUsers = [
      { role: 'VIEWER', email: (await ensureRoleUser(request, id, 'VIEWER')).email },
      { role: 'PROCESSOR', email: (await ensureRoleUser(request, id, 'PROCESSOR')).email },
      { role: 'UNDERWRITER', email: (await ensureRoleUser(request, id, 'UNDERWRITER')).email },
    ];

    await runFlow(recorder, obs, passAFlows[0], async (f) => {
      f.stepCount += 1;
      await loginUi(page, missionUser!.email, missionUser!.password);
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      await perf(recorder, page, passAFlows[0].pass, passAFlows[0].id, 'dashboard-cold-start');

      f.stepCount += 1;
      await page.goto(`${BASE_URL}/clients`);
      await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible();
      await perf(recorder, page, passAFlows[0].pass, passAFlows[0].id, 'clients-empty');

      f.stepCount += 1;
      const c = {
        name: `Mission Client A ${ts}`,
        email: `mission-a-${ts}@example.com`,
        phone: '5551010001',
      };
      const idA = await createClient(page, c);
      clients.push({ id: idA, ...c });
    });

    await runFlow(recorder, obs, passAFlows[1], async (f) => {
      if (!clients[0]) throw new Error('need client A');
      const checks = [
        { tab: 'notes', txt: 'No notes yet' },
        { tab: 'tasks', txt: 'No tasks yet' },
        { tab: 'documents', txt: 'No documents yet' },
        { tab: 'loans', txt: 'No loan scenarios yet' },
        { tab: 'communications', txt: 'No communications yet' },
      ];
      for (const c of checks) {
        f.stepCount += 1;
        await clientTab(page, clients[0].id, c.tab);
        const ok = await page.getByText(c.txt).isVisible().catch(() => false);
        if (!ok) f.frictionPoints.push(`empty state unclear on ${c.tab}`);
      }

      f.stepCount += 1;
      await page.goto(`${BASE_URL}/clients`);
      await page.getByRole('button', { name: 'Add Client' }).first().click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Name').fill('Invalid Client');
      await d.getByLabel('Email').fill('bad-email');
      await d.getByLabel('Phone').fill('###');
      await d.getByRole('button', { name: 'Create Client' }).click();
      await expect(page.getByText('Please enter a valid email address')).toBeVisible();
      await d.getByRole('button', { name: 'Cancel' }).click();

      f.stepCount += 1;
      await clientTab(page, clients[0].id, 'notes');
      await page.getByRole('button', { name: 'Add Note' }).first().click();
      const addNoteDialog = page.getByRole('dialog', { name: 'Add Note' });
      await addNoteDialog.getByRole('button', { name: /^Save$/ }).click();
      await expect(page.getByText('Note text is required')).toBeVisible();
      await addNoteDialog.getByRole('button', { name: 'Cancel' }).click();

      f.stepCount += 1;
      await clientTab(page, clients[0].id, 'tasks');
      await page.getByRole('button', { name: 'Add Task' }).first().click();
      const addTaskDialog = page.getByRole('dialog', { name: 'Add Task' });
      await addTaskDialog.getByRole('button', { name: /^Save$/ }).click();
      await expect(page.getByText('Task text is required')).toBeVisible();
      await addTaskDialog.getByRole('button', { name: 'Cancel' }).click();

      f.stepCount += 1;
      const vx = await browser.newContext();
      const vp = await vx.newPage();
      await loginUi(vp, 'viewer@example.com');
      await vp.goto(`${BASE_URL}/communications/compose`, { waitUntil: 'domcontentloaded' });
      const denied = await isAccessDenied(vp);
      await vx.close();
      if (!denied) {
        await logIssue({
          pass: passAFlows[1].pass,
          flowId: passAFlows[1].id,
          role: 'VIEWER',
          title: 'Viewer can access compose page',
          category: 'Reliability',
          severity: 'P0',
          steps: ['Login as viewer@example.com', 'Open /communications/compose'],
          expected: 'Access Denied page',
          actual: 'Viewer reached write route',
          impact: 'Permission boundary break',
          suggestedFix: 'Enforce route guards for all write paths',
          score: { frequency: 4, pain: 5, risk: 5, effort: 2 },
          shot: 'viewer-route-bypass',
        });
      }
    });

    await runFlow(recorder, obs, passBFlows[0], async (f) => {
      const b = { name: `Mission Client B ${ts}`, email: `mission-b-${ts}@example.com`, phone: '5551010002' };
      const c = { name: `Mission Client C ${ts}`, email: `mission-c-${ts}@example.com`, phone: '5551010003' };
      f.stepCount += 1;
      const bId = await createClient(page, b);
      clients.push({ id: bId, ...b });
      f.stepCount += 1;
      const cId = await createClient(page, c);
      clients.push({ id: cId, ...c });
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/clients/${bId}`);
      await page.getByRole('button', { name: 'Edit' }).click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Phone').fill('5559091234');
      await d.getByLabel('Status').click();
      await page.getByRole('option', { name: 'Active' }).click();
      await d.getByRole('button', { name: /^Save$/ }).click();
      await expect(page.getByText('Client updated successfully')).toBeVisible();
      f.stepCount += 1;
      const tags = page.getByRole('textbox', { name: 'Tags' }).first();
      await tags.fill('vip');
      await page.keyboard.press('Enter');
      await expect(page.getByText('Tags Updated').first()).toBeVisible();
    });

    await runFlow(recorder, obs, passBFlows[1], async (f) => {
      if (!clients[1]) throw new Error('need client B');
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/pipeline`);
      await perf(recorder, page, passBFlows[1].pass, passBFlows[1].id, 'pipeline');
      await dragClientToStage(page, clients[1].name, 'PROCESSING');
      await expect
        .poll(
          async () => {
            const updated = await apiJson(request, missionAuth!, 'GET', `/clients/${clients[1].id}`);
            return updated.status;
          },
          { timeout: 12_000, intervals: [500, 1000, 1500] }
        )
        .toBe('PROCESSING');
    });

    await runFlow(recorder, obs, passBFlows[2], async (f) => {
      if (!clients[1]) throw new Error('need client B');
      opNote = `Mission note ${id}`;
      opTask = `Mission task ${id}`;
      const call = `Mission call ${id}`;
      f.stepCount += 1;
      await clientTab(page, clients[1].id, 'notes');
      await page.getByRole('button', { name: 'Add Note' }).first().click();
      const addNoteDialog = page.getByRole('dialog', { name: 'Add Note' });
      await addNoteDialog.getByRole('textbox', { name: 'Note' }).fill(opNote);
      await addNoteDialog.getByRole('button', { name: /^Save$/ }).click();
      await expect(page.getByText('Note created successfully')).toBeVisible();
      f.stepCount += 1;
      await clientTab(page, clients[1].id, 'tasks');
      await page.getByRole('button', { name: 'Add Task' }).first().click();
      const addTaskDialog = page.getByRole('dialog', { name: 'Add Task' });
      await addTaskDialog.getByRole('textbox', { name: 'Task' }).fill(opTask);
      await addTaskDialog.getByRole('button', { name: /^Save$/ }).click();
      await expect(page.getByText('Task created successfully')).toBeVisible();
      f.stepCount += 1;
      await page.getByRole('button', { name: 'Log Interaction' }).click();
      const logDialog = page.getByRole('dialog', { name: 'Log Interaction' });
      await logDialog.getByRole('textbox', { name: 'Interaction Type' }).click();
      await page.getByRole('option', { name: 'Call Placed' }).click();
      await logDialog.getByRole('textbox', { name: 'Description' }).fill(call);
      await logDialog.getByRole('button', { name: 'Log Interaction' }).click();
      await expect(page.getByText('Interaction Logged')).toBeVisible();
    });

    await runFlow(recorder, obs, passBFlows[3], async (f) => {
      if (!clients[1]) throw new Error('need client B');
      const doc = `Income Statement ${id}`;
      f.stepCount += 1;
      await clientTab(page, clients[1].id, 'documents');
      await page.getByRole('button', { name: 'Request Document' }).click();
      await page.getByLabel('Document Name').fill(doc);
      await page.getByRole('button', { name: 'Send Request' }).click();
      await expect(page.getByText('Document request')).toBeVisible();
    });

    await runFlow(recorder, obs, passBFlows[4], async (f) => {
      if (!clients[1]) throw new Error('need client B');
      const subject = `Mission Update ${id}`;
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/communications/${clients[1].id}/compose`);
      await page.getByLabel('Subject').fill(subject);
      await page.locator('#compose-body').fill(`Hello {{client_name}} ${id}`);
      await page.getByRole('button', { name: 'Save Draft' }).click();
      await expect(page).toHaveURL(/\/communications/);
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/communications/${clients[1].id}/compose`);
      await page.getByLabel('Subject').fill(`Mission Sent ${id}`);
      await page.locator('#compose-body').fill(`send now ${id}`);
      await page.getByRole('button', { name: 'Send Now' }).click();
      await expect(page.getByText('Communication sent successfully').first()).toBeVisible();
    });

    await runFlow(recorder, obs, passBFlows[5], async (f) => {
      if (!clients[1] || !clients[2]) throw new Error('need clients B/C');
      const t0 = Date.now();
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/clients`);
      await page.getByPlaceholder('Search clients...').fill(clients[2].name);
      await expect(page.getByText(clients[2].name).first()).toBeVisible();
      const a = Date.now() - t0;
      const t1 = Date.now();
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/tasks`);
      await page.getByPlaceholder('Search tasks...').fill(opTask);
      await expect(page.getByText(opTask).first()).toBeVisible({ timeout: 20_000 });
      const b = Date.now() - t1;
      const t2 = Date.now();
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/notes`);
      await page.getByPlaceholder('Search notes or client names...').fill(clients[1].name);
      await expect(page.getByText(clients[1].name).first()).toBeVisible();
      const c = Date.now() - t2;
      const t3 = Date.now();
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/communications`);
      await page.getByPlaceholder('Search by client name, subject, or body...').fill(clients[1].name);
      await page.keyboard.press('Enter');
      await expect(page.getByText(clients[1].name).first()).toBeVisible();
      const d = Date.now() - t3;
      const slow = Math.max(a, b, c, d);
      if (slow > 4500) {
        await logIssue({
          pass: passBFlows[5].pass,
          flowId: passBFlows[5].id,
          role: 'MLO',
          title: 'Core search is slow across modules',
          category: 'Performance',
          severity: 'P2',
          steps: ['Run clients/tasks/notes/communications search flow'],
          expected: 'Each screen responds in about 2s locally',
          actual: `Slowest screen took ${slow}ms`,
          impact: 'Breaks operator momentum',
          suggestedFix: 'Reduce query payload and optimize filter/search calls',
          score: { frequency: 4, pain: 3, risk: 3, effort: 2 },
          shot: 'slow-search-flow',
        });
      }
    });

    await runFlow(recorder, obs, passBFlows[6], async (f) => {
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/`);
      await page.getByLabel('Notifications').click();
      const empty = await page.getByText('No notifications yet').isVisible().catch(() => false);
      if (empty) {
        await logIssue({
          pass: passBFlows[6].pass,
          flowId: passBFlows[6].id,
          role: 'MLO',
          title: 'No actionable notifications during mission run',
          category: 'UX friction',
          severity: 'P3',
          steps: ['Complete key flows', 'Open notification center'],
          expected: 'At least one actionable event in notification center',
          actual: 'Notification center remained empty',
          impact: 'Reduces trust in bell indicator',
          suggestedFix: 'Emit key action notifications with deep links',
          score: { frequency: 3, pain: 2, risk: 2, effort: 2 },
          shot: 'empty-notifications',
        });
      }
    });

    await runFlow(recorder, obs, passBFlows[7], async (f) => {
      for (const roleUser of readOnlyUsers) {
        f.stepCount += 1;
        const cx = await browser.newContext();
        const rp = await cx.newPage();
        await loginUi(rp, roleUser.email);
        await rp.goto(`${BASE_URL}/communications/compose`, { waitUntil: 'domcontentloaded' });
        const denied = await isAccessDenied(rp);
        await cx.close();
        if (!denied) {
          await logIssue({
            pass: passBFlows[7].pass,
            flowId: passBFlows[7].id,
            role: roleUser.role,
            title: `${roleUser.email} reached restricted compose route`,
            category: 'Reliability',
            severity: 'P1',
            steps: [`Login as ${roleUser.email}`, 'Open /communications/compose'],
            expected: 'Access Denied',
            actual: 'Restricted route accessible',
            impact: 'Role model confusion',
            suggestedFix: 'Apply consistent write-route guards',
            score: { frequency: 4, pain: 4, risk: 4, effort: 2 },
            shot: `role-bypass-${roleUser.role.toLowerCase()}`,
          });
        }
      }
    });

    await runFlow(recorder, obs, passCFlows[0], async (f) => {
      f.stepCount += 1;
      const r10 = `${id}-10x`;
      sh([
        'scripts/qa-seed-mission-data.mjs',
        '--scale',
        '10x',
        '--runId',
        r10,
        '--email',
        missionUser!.email,
        '--password',
        missionUser!.password,
      ]);
      seedRuns.push(r10);
      await page.goto(`${BASE_URL}/clients`);
      await page.getByPlaceholder('Search clients...').fill(`MLO_MISSION_${r10}_CLIENT_`);
      const seededVisible = await expect
        .poll(
          async () => page.getByText(new RegExp(`MLO_MISSION_${r10}_CLIENT_`, 'i')).first().isVisible().catch(() => false),
          { timeout: 20_000, intervals: [500, 1000, 1500] }
        )
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);
      if (!seededVisible) {
        f.frictionPoints.push('10x seeded clients were not discoverable via clients search.');
        await logIssue({
          pass: passCFlows[0].pass,
          flowId: passCFlows[0].id,
          role: 'MLO',
          title: '10x seeded clients are difficult to discover in clients search',
          category: 'UX friction',
          severity: 'P2',
          steps: ['Seed 10x mission dataset', 'Open Clients page', 'Search for seeded prefix'],
          expected: 'Seeded clients appear in list search results',
          actual: 'No visible seeded result in UI search check',
          impact: 'Large-list workflows become hard to validate and navigate quickly.',
          suggestedFix: 'Improve search indexing and expose deterministic sort/filter for recent seeded records.',
          score: { frequency: 3, pain: 3, risk: 3, effort: 2 },
          shot: '10x-search-discovery',
        });
      }
      await perf(recorder, page, passCFlows[0].pass, passCFlows[0].id, 'clients-10x');
      f.stepCount += 1;
      if (process.env.MLO_MISSION_ENABLE_100X === 'true') {
        const r100 = `${id}-100x`;
        sh(
          [
            'scripts/qa-seed-mission-data.mjs',
            '--scale',
            '100x',
            '--runId',
            r100,
            '--email',
            missionUser!.email,
            '--password',
            missionUser!.password,
          ],
          26 * 60 * 1000
        );
        seedRuns.push(r100);
        const summaryPath = path.resolve('output/playwright/mlo-mission', r100, 'seed-summary.json');
        if (fs.existsSync(summaryPath)) {
          const s = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as { fallbackTriggered?: boolean; fallbackReason?: string };
          if (s.fallbackTriggered) noteLog.push(`100x fallback: ${s.fallbackReason || 'unknown'}`);
        }
      } else {
        noteLog.push('100x skipped by default; set MLO_MISSION_ENABLE_100X=true to attempt.');
      }
    });

    await runFlow(recorder, obs, passCFlows[1], async (f) => {
      f.stepCount += 1;
      const hiddenWindowUnreadResponses: Array<{ timestamp: number; status: number }> = [];
      const onUnreadResponse = (response: { url: () => string; status: () => number }) => {
        if (response.url().includes('/notifications/unread-count')) {
          hiddenWindowUnreadResponses.push({ timestamp: Date.now(), status: response.status() });
        }
      };
      page.on('response', onUnreadResponse);
      const other = await context.newPage();
      await other.goto('about:blank');
      await other.bringToFront();
      await wait(5_000);
      const steadyWindowStart = Date.now();
      await wait(30_000);
      await other.close();
      await page.bringToFront();
      page.off('response', onUnreadResponse);
      const hiddenPolls = hiddenWindowUnreadResponses.filter(
        (sample) =>
          sample.timestamp >= steadyWindowStart &&
          sample.status >= 200 &&
          sample.status < 400
      ).length;
      if (hiddenPolls > 1) {
        await logIssue({
          pass: passCFlows[1].pass,
          flowId: passCFlows[1].id,
          role: 'MLO',
          title: 'Unread polling continues on hidden tab',
          category: 'Performance',
          severity: 'P1',
          steps: ['Open dashboard tab', 'Switch to another tab for 35s', 'Observe /notifications/unread-count calls'],
          expected: 'No sustained hidden-tab polling',
          actual: `${hiddenPolls} hidden-tab calls observed in check window`,
          impact: 'Background API churn and battery impact',
          suggestedFix: 'Pause polling when document is hidden',
          score: { frequency: 5, pain: 3, risk: 3, effort: 1 },
          shot: 'hidden-tab-polling',
        });
      }
      f.stepCount += 1;
      await page.evaluate(() => {
        localStorage.setItem('mlo-session-persistent', 'false');
        const raw = localStorage.getItem('mlo-auth-storage');
        if (!raw) return;
        const parsed = JSON.parse(raw) as { state?: { lastActivity?: number } };
        if (!parsed.state) parsed.state = {};
        parsed.state.lastActivity = Date.now() - (60 * 60 * 1000);
        localStorage.setItem('mlo-auth-storage', JSON.stringify(parsed));
      });
      await page.reload();
      await wait(35_000);
      if (/\/login/.test(page.url())) {
        await loginUi(page, missionUser!.email, missionUser!.password);
      } else {
        noteLog.push('Inactivity timeout did not trigger in simulated window');
      }
    });

    await runFlow(recorder, obs, passCFlows[2], async (f) => {
      f.stepCount += 1;
      const delay = async (route: any) => {
        await wait(800);
        try {
          await route.continue();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes('Route is already handled')) {
            throw error;
          }
        }
      };
      await context.route('**/api/**', delay);
      await page.goto(`${BASE_URL}/tasks`);
      await expect(page.getByRole('heading', { name: 'Tasks Dashboard' })).toBeVisible({ timeout: 30_000 });
      await perf(recorder, page, passCFlows[2].pass, passCFlows[2].id, 'tasks-slow-network');
      await context.unroute('**/api/**', delay);
      f.stepCount += 1;
      await context.setOffline(true);
      const offlineErr = await page.goto(`${BASE_URL}/clients`).then(() => null).catch((e) => e);
      await context.setOffline(false);
      await page.goto(`${BASE_URL}/clients`);
      await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
      if (!offlineErr) {
        await logIssue({
          pass: passCFlows[2].pass,
          flowId: passCFlows[2].id,
          role: 'MLO',
          title: 'Offline mode lacks clear in-app recovery feedback',
          category: 'Reliability',
          severity: 'P2',
          steps: ['Set browser offline', 'Open /clients', 'Return online'],
          expected: 'Clear offline/retry guidance',
          actual: 'No explicit offline guidance captured',
          impact: 'Users cannot tell whether failure is network or app',
          suggestedFix: 'Show global offline banner with retry action',
          score: { frequency: 3, pain: 3, risk: 3, effort: 2 },
          shot: 'offline-feedback',
          network: 'offline',
        });
      }
    });

    await runFlow(recorder, obs, passCFlows[3], async (f) => {
      if (!clients[0]) throw new Error('need client A');
      f.stepCount += 1;
      const t = `Rapid Note ${id}`;
      await clientTab(page, clients[0].id, 'notes');
      await page.getByRole('button', { name: 'Add Note' }).first().click();
      const addNoteDialog = page.getByRole('dialog', { name: 'Add Note' });
      await addNoteDialog.getByRole('textbox', { name: 'Note' }).fill(t);
      const save = addNoteDialog.getByRole('button', { name: /^Save$/ });
      await Promise.all([save.click(), save.click()]);
      await wait(1200);
      const notes = await apiJson(request, missionAuth!, 'GET', `/notes?client_id=${clients[0].id}`) as Array<{ text?: string }>;
      const dup = notes.filter((n) => n.text === t).length;
      if (dup > 1) {
        await logIssue({
          pass: passCFlows[3].pass,
          flowId: passCFlows[3].id,
          role: 'MLO',
          title: 'Double submit created duplicate notes',
          category: 'Reliability',
          severity: 'P1',
          steps: ['Open Add Note', 'Fill text', 'Double-click Save'],
          expected: 'Single record created',
          actual: `${dup} records created`,
          impact: 'Data duplication and timeline noise',
          suggestedFix: 'Disable Save after first click and enforce idempotency',
          score: { frequency: 4, pain: 4, risk: 4, effort: 2 },
          shot: 'duplicate-note',
        });
      }
      f.stepCount += 1;
      const p1 = await context.newPage();
      const p2 = await context.newPage();
      await p1.goto(`${BASE_URL}/clients/${clients[0].id}`);
      await p2.goto(`${BASE_URL}/clients/${clients[0].id}`);
      await p1.getByRole('button', { name: 'Edit' }).click();
      await p1.getByLabel('Phone').fill('5550001111');
      await p1.getByRole('button', { name: /^Save$/ }).click();
      await expect(p1.getByText('Client updated successfully')).toBeVisible();
      await p2.getByRole('button', { name: 'Edit' }).click();
      await p2.getByLabel('Phone').fill('5550002222');
      await p2.getByRole('button', { name: /^Save$/ }).click();
      const stale = await p2.getByText('Client updated successfully').isVisible().catch(() => false);
      await p1.close();
      await p2.close();
      if (stale) {
        await logIssue({
          pass: passCFlows[3].pass,
          flowId: passCFlows[3].id,
          role: 'MLO',
          title: 'Stale concurrent edit saved with no conflict warning',
          category: 'Reliability',
          severity: 'P2',
          steps: ['Open same client in two tabs', 'Save in tab A', 'Save stale edit in tab B'],
          expected: 'Conflict warning on stale edit',
          actual: 'Stale save succeeded silently',
          impact: 'Potential lost updates',
          suggestedFix: 'Add optimistic concurrency check with conflict toast',
          score: { frequency: 3, pain: 4, risk: 4, effort: 3 },
          shot: 'stale-concurrency',
        });
      }
    });

    await runFlow(recorder, obs, passCFlows[4], async (f) => {
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/tasks`);
      const checks = page.locator('tbody input[type="checkbox"]');
      if (await checks.count() >= 2) {
        await checks.nth(0).click();
        await checks.nth(1).click();
        await page.getByRole('button', { name: 'Mark Complete' }).click();
        await expect(page.getByText('Bulk action completed successfully')).toBeVisible();
      }
      f.stepCount += 1;
      await page.goto(`${BASE_URL}/communications`);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => document.activeElement?.tagName ?? '');
      if (!active || active === 'BODY') {
        await logIssue({
          pass: passCFlows[4].pass,
          flowId: passCFlows[4].id,
          role: 'MLO',
          title: 'Keyboard focus did not advance to actionable controls',
          category: 'Accessibility',
          severity: 'P1',
          steps: ['Open communications', 'Press Tab repeatedly'],
          expected: 'Visible actionable control receives focus',
          actual: 'Focus remained on body/non-actionable element',
          impact: 'Keyboard-only users blocked',
          suggestedFix: 'Audit tab order and focusability',
          score: { frequency: 3, pain: 5, risk: 4, effort: 2 },
          shot: 'keyboard-focus',
        });
      }
      f.stepCount += 1;
      await page.evaluate(() => {
        document.body.style.zoom = '200%';
      });
      await wait(800);
      const compose = await page.getByRole('button', { name: 'Compose' }).isVisible().catch(() => false);
      await page.evaluate(() => {
        document.body.style.zoom = '100%';
      });
      if (!compose) {
        await logIssue({
          pass: passCFlows[4].pass,
          flowId: passCFlows[4].id,
          role: 'MLO',
          title: 'Compose action not visible at 200% zoom',
          category: 'Accessibility',
          severity: 'P2',
          steps: ['Open communications', 'Set zoom to 200%'],
          expected: 'Compose remains visible/reachable',
          actual: 'Compose not visible in quick check',
          impact: 'Low-vision friction',
          suggestedFix: 'Adjust high-zoom layout and sticky actions',
          score: { frequency: 2, pain: 3, risk: 3, effort: 2 },
          shot: 'zoom-compose',
        });
      }
    });
  } finally {
    obs.stop();
    for (const s of seedRuns) {
      try {
        sh(
          [
            'scripts/qa-cleanup-mission-data.mjs',
            '--runId',
            s,
            '--email',
            missionUser?.email || 'mlo@example.com',
            '--password',
            missionUser?.password || PASSWORD,
          ],
          15 * 60 * 1000
        );
      } catch (e) {
        noteLog.push(`cleanup failed for ${s}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const networkSummary = obs.getSummary();
    recorder.setNetwork(networkSummary, obs.getSamples());

    const isExpectedFailureEndpoint = (url: string, status: number | null): boolean => {
      if (url.includes('/api/auth/refresh') && (status === 400 || status === 401)) return true;
      if (url.includes('/api/notifications/unread-count') && status === 401) return true;
      if (url.endsWith('/clients') && status === null) return true; // expected during offline scenario
      return false;
    };

    const actionableFailedRequests = networkSummary.failedEndpoints
      .filter((endpoint) => !isExpectedFailureEndpoint(endpoint.url, endpoint.status))
      .reduce((sum, endpoint) => sum + endpoint.count, 0);

    if (actionableFailedRequests > 0) {
      logDerivedIssue({
        pass: 'PASS_C',
        flowId: 'pass-c-network-throttle-offline',
        role: 'MLO',
        title: 'Mission run recorded failed network requests',
        category: 'Reliability',
        severity: 'P2',
        steps: ['Run full mission', 'Review network-summary.json failedRequests'],
        expected: 'Core mission flows complete with minimal failed requests',
        actual: `${actionableFailedRequests} actionable failed requests captured`,
        impact: 'Raises risk of intermittent user-facing errors under real usage.',
        suggestedFix: 'Handle request cancellations explicitly and reduce avoidable retries/timeouts.',
        score: { frequency: 4, pain: 3, risk: 3, effort: 2 },
      });
    }

    const heaviest = networkSummary.largestPayloads.find(
      (sample) => !sample.url.includes('/node_modules/.vite/deps/')
    );
    if (heaviest && heaviest.responseBytes > 1_000_000) {
      logDerivedIssue({
        pass: 'PASS_C',
        flowId: 'pass-c-large-data-10x-100x',
        role: 'MLO',
        title: 'Largest frontend payload is over 1 MB',
        category: 'Performance',
        severity: 'P2',
        steps: ['Run full mission', 'Review network-summary.json largestPayloads'],
        expected: 'Top static payloads should stay below 1 MB for responsive cold loads',
        actual: `${heaviest.responseBytes} bytes served from ${heaviest.url}`,
        impact: 'Slower initial rendering on weaker connections/devices.',
        suggestedFix: 'Split heavy UI/icon bundles and lazy-load rarely used icon sets.',
        score: { frequency: 4, pain: 3, risk: 3, effort: 2 },
      });
    }

    const chatty = networkSummary.callsByScreen[0];
    if (chatty && chatty.calls >= 120) {
      logDerivedIssue({
        pass: 'PASS_B',
        flowId: 'pass-b-search-filter-drilldown',
        role: 'MLO',
        title: `High API chatter on ${chatty.screen} screen`,
        category: 'Performance',
        severity: 'P2',
        steps: ['Run mission core workflows', 'Inspect callsByScreen in network summary'],
        expected: 'High-traffic screens should avoid unnecessary repeated API calls',
        actual: `${chatty.calls} API calls recorded for ${chatty.screen}`,
        impact: 'Increases latency and server load during normal operations.',
        suggestedFix: 'Debounce refresh triggers and consolidate parallel fetches on client detail views.',
        score: { frequency: 5, pain: 3, risk: 3, effort: 2 },
      });
    }

    for (const endpoint of networkSummary.failedEndpoints.slice(0, 6)) {
      if (isExpectedFailureEndpoint(endpoint.url, endpoint.status)) continue;
      if (endpoint.count < 3) continue;
      logDerivedIssue({
        pass: 'PASS_C',
        flowId: 'pass-c-network-throttle-offline',
        role: 'MLO',
        title: `Frequent request failures on ${endpoint.url}`,
        category: 'Reliability',
        severity: 'P2',
        steps: ['Run full mission', 'Inspect failedEndpoints list in network summary'],
        expected: 'Critical endpoints should not repeatedly fail during normal navigation',
        actual: `${endpoint.count} failures observed${endpoint.status ? ` (status ${endpoint.status})` : ''}`,
        impact: 'Users may see stale panels, missing data, or inconsistent state.',
        suggestedFix: 'Add retry/backoff for transient failures and suppress noisy calls during route transitions.',
        score: { frequency: 4, pain: 3, risk: 3, effort: 2 },
      });
    }

    if (noteLog.some((note) => note.includes('Inactivity timeout did not trigger'))) {
      logDerivedIssue({
        pass: 'PASS_C',
        flowId: 'pass-c-session-recovery',
        role: 'MLO',
        title: 'Inactivity timeout simulation did not force re-authentication',
        category: 'Reliability',
        severity: 'P2',
        steps: ['Set stale lastActivity in storage', 'Reload app and wait for inactivity window'],
        expected: 'Session should reliably expire after configured inactivity timeout',
        actual: 'Session remained active in simulation check',
        impact: 'Session behavior may be unpredictable for long-lived tabs.',
        suggestedFix: 'Unify inactivity checks across app init and runtime heartbeat timers.',
        score: { frequency: 3, pain: 3, risk: 4, effort: 2 },
      });
    }

    const failedFlows = recorder.getFlows().filter((flow) => flow.status === 'FAIL');
    for (const flow of failedFlows.slice(0, 3)) {
      logDerivedIssue({
        pass: flow.pass,
        flowId: flow.flowId,
        role: 'MLO',
        title: `Mission flow failed: ${flow.title}`,
        category: 'UX friction',
        severity: 'P2',
        steps: [`Run mission flow ${flow.flowId}`, 'Review flow-metrics friction notes'],
        expected: 'Flow completes end-to-end without retries/backtracks.',
        actual: flow.frictionPoints[0] || 'Flow ended with failure status.',
        impact: 'Introduces uncertainty and extra manual recovery steps for operators.',
        suggestedFix: 'Stabilize flow interactions and add explicit in-app completion feedback.',
        score: { frequency: 3, pain: 3, risk: 3, effort: 2 },
      });
    }

    const ranked = sortIssuesByPriority(issues);
    const quick = selectQuickWins(ranked, 3);
    const c = counts(issues);
    const open = c.P0 + c.P1;
    recorder.saveMissionSummary({
      runId: id,
      startedAt: startIso,
      endedAt: new Date().toISOString(),
      environment: {
        baseUrl: BASE_URL,
        apiBaseUrl: API_BASE_URL,
        browser: 'chromium',
        os: `${os.platform()} ${os.release()}`,
      },
      issueCounts: c,
      openP0P1Count: open,
      releaseGate: open > 0 ? 'FAIL' : 'PASS',
      top10IssueIds: ranked.slice(0, 10).map((i) => i.id),
      quickWinIssueIds: quick.map((i) => i.id),
      notes: noteLog,
    });
    recorder.flush();
    await context.close();
  }
});

test('@quickwin-regression validates quick-win fixes', async ({ browser, request }) => {
  test.setTimeout(30 * 60 * 1000);

  const auth = await loginApi(request, 'mlo@example.com');
  const m = Date.now();
  const keyword = `zeta-${m}`;

  const clientA = await apiJson(request, auth, 'POST', '/clients', {
    name: `Quickwin Name Match ${keyword}`,
    email: `quickwin-a-${m}@example.com`,
    phone: '5558881001',
    status: 'LEAD',
  });
  const clientB = await apiJson(request, auth, 'POST', '/clients', {
    name: 'Quickwin Body Match',
    email: `quickwin-b-${m}@example.com`,
    phone: '5558881002',
    status: 'LEAD',
  });

  await apiJson(request, auth, 'POST', '/notes', {
    clientId: clientA.id,
    text: `${'Long note '.repeat(120)}${keyword}`,
    tags: ['quickwin'],
  });

  await apiJson(request, auth, 'POST', '/communications', {
    clientId: clientB.id,
    type: 'EMAIL',
    subject: `Body match ${keyword}`,
    body: `contains ${keyword}`,
  });
  await wait(50);
  await apiJson(request, auth, 'POST', '/communications', {
    clientId: clientA.id,
    type: 'EMAIL',
    subject: `Name match ${keyword}`,
    body: 'no keyword here',
  });

  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    await loginUi(page, 'mlo@example.com');

    await page.goto(`${BASE_URL}/notes`);
    await page.getByPlaceholder('Search notes or client names...').fill(keyword);
    await expect(page.getByText(clientA.name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show more' })).toBeVisible();

    const unreadReqs: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/notifications/unread-count')) unreadReqs.push(r.url());
    });

    const before = unreadReqs.length;
    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await wait(35_000);
    const after = unreadReqs.length;
    await other.close();

    expect(after - before).toBeLessThanOrEqual(1);

    const search = await apiJson(request, auth, 'GET', `/communications?q=${encodeURIComponent(keyword)}&page=1&limit=10`);
    expect(Array.isArray(search.data)).toBeTruthy();
    expect(search.data[0]?.clientName).toContain('Quickwin Name Match');
  } finally {
    await context.close();
  }
});
