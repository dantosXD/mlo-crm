#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_API_BASE_URL = process.env.QA_API_BASE_URL || 'http://127.0.0.1:3002/api';
const DEFAULT_EMAIL = process.env.QA_SEED_EMAIL || 'mlo@example.com';
const DEFAULT_PASSWORD = process.env.QA_SEED_PASSWORD || 'password123';
const MAX_100X_DURATION_MS = 20 * 60 * 1000;

const TARGETS = {
  baseline: { clients: 30, notes: 90, tasks: 90, communications: 60 },
  '10x': { clients: 300, notes: 900, tasks: 900, communications: 600 },
  '30x': { clients: 900, notes: 2700, tasks: 2700, communications: 1800 },
  '100x': { clients: 3000, notes: 9000, tasks: 9000, communications: 6000 },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = value && !value.startsWith('--') ? value : 'true';
    if (value && !value.startsWith('--')) i += 1;
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(array, size) {
  const groups = [];
  for (let i = 0; i < array.length; i += size) {
    groups.push(array.slice(i, i + size));
  }
  return groups;
}

function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function login(apiBaseUrl, email, password) {
  const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    const body = await loginResponse.text();
    throw new Error(`Login failed (${loginResponse.status}): ${body}`);
  }
  const loginData = await loginResponse.json();
  const loginCookies =
    typeof loginResponse.headers.getSetCookie === 'function'
      ? loginResponse.headers.getSetCookie()
      : [];
  const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  });
  const meCookies =
    typeof meResponse.headers.getSetCookie === 'function'
      ? meResponse.headers.getSetCookie()
      : [];
  const cookieHeader = [...loginCookies, ...meCookies]
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
  const csrfToken = meResponse.headers.get('x-csrf-token') || '';
  return {
    accessToken: loginData.accessToken,
    csrfToken,
    cookieHeader,
    user: loginData.user,
  };
}

async function apiJson(apiBaseUrl, endpoint, token, csrfToken, cookieHeader, method, body, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${method} ${endpoint} failed (${response.status}): ${text}`);
      }

      return response.status === 204 ? null : response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(200 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError || new Error(`${method} ${endpoint} failed`);
}

function shouldFallbackFrom100x(scale, startedAt, fallbackTriggered) {
  if (scale !== '100x' || fallbackTriggered) return false;
  return Date.now() - startedAt > MAX_100X_DURATION_MS;
}

async function main() {
  const args = parseArgs(process.argv);
  const scale = args.scale || 'baseline';
  const runId = args.runId || nowIsoCompact();
  const apiBaseUrl = args.apiBaseUrl || DEFAULT_API_BASE_URL;
  const email = args.email || DEFAULT_EMAIL;
  const password = args.password || DEFAULT_PASSWORD;

  if (!TARGETS[scale]) {
    throw new Error(`Invalid --scale "${scale}". Use baseline|10x|100x.`);
  }

  const auth = await login(apiBaseUrl, email, password);
  console.log(`[seed] Authenticated as ${auth.user?.email || DEFAULT_EMAIL}`);

  const outputDir = path.resolve('output/playwright/mlo-mission', runId);
  ensureDir(outputDir);

  const prefix = `MLO_MISSION_${runId}_`;
  const startedAt = Date.now();
  const target = { ...TARGETS[scale] };
  const fallbackTarget = { ...TARGETS['30x'] };
  let fallbackTriggered = false;
  let fallbackReason = '';

  const createdClientIds = [];
  const createdNoteIds = [];
  const createdTaskIds = [];
  const createdCommunicationIds = [];

  const statusCycle = ['LEAD', 'PRE_QUALIFIED', 'ACTIVE', 'PROCESSING', 'UNDERWRITING'];

  for (let i = 0; i < target.clients; i += 1) {
    if (shouldFallbackFrom100x(scale, startedAt, fallbackTriggered)) {
      fallbackTriggered = true;
      fallbackReason = '100x generation exceeded 20 minutes; switched to 30x fallback target';
      target.clients = fallbackTarget.clients;
      target.notes = fallbackTarget.notes;
      target.tasks = fallbackTarget.tasks;
      target.communications = fallbackTarget.communications;
      console.log(`[seed] ${fallbackReason}`);
    }

    const index = i + 1;
    const payload = {
      name: `${prefix}CLIENT_${index.toString().padStart(4, '0')}`,
      email: `${prefix.toLowerCase()}client${index}@example.com`,
      phone: `555${`${index}`.padStart(7, '0')}`,
      status: statusCycle[i % statusCycle.length],
      tags: JSON.stringify(['mlo-mission', `run-${runId}`, `batch-${Math.floor(i / 50) + 1}`]),
    };

    const client = await apiJson(
      apiBaseUrl,
      '/clients',
      auth.accessToken,
      auth.csrfToken,
      auth.cookieHeader,
      'POST',
      payload
    );
    createdClientIds.push(client.id);

    if ((index % 50) === 0 || index === target.clients) {
      console.log(`[seed] Created clients: ${index}/${target.clients}`);
    }
  }

  if (createdClientIds.length === 0) {
    throw new Error('No clients were created, cannot continue seeding notes/tasks/communications.');
  }

  for (let i = 0; i < target.notes; i += 1) {
    const clientId = createdClientIds[i % createdClientIds.length];
    const index = i + 1;
    const note = await apiJson(
      apiBaseUrl,
      '/notes',
      auth.accessToken,
      auth.csrfToken,
      auth.cookieHeader,
      'POST',
      {
        clientId,
        text: `${prefix}NOTE_${index}: Mission seed note content for UX/performance testing.`,
        tags: ['mlo-mission', 'seeded'],
      }
    );
    createdNoteIds.push(note.id);
    if ((index % 250) === 0 || index === target.notes) {
      console.log(`[seed] Created notes: ${index}/${target.notes}`);
    }
  }

  for (let i = 0; i < target.tasks; i += 1) {
    const clientId = createdClientIds[i % createdClientIds.length];
    const index = i + 1;
    const dueDate = new Date(Date.now() + ((i % 21) - 10) * 24 * 60 * 60 * 1000).toISOString();
    const task = await apiJson(
      apiBaseUrl,
      '/tasks',
      auth.accessToken,
      auth.csrfToken,
      auth.cookieHeader,
      'POST',
      {
        clientId,
        text: `${prefix}TASK_${index}: Follow-up task for mission load testing`,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][i % 4],
        status: i % 9 === 0 ? 'COMPLETE' : 'TODO',
        dueDate,
      }
    );
    createdTaskIds.push(task.id);
    if ((index % 250) === 0 || index === target.tasks) {
      console.log(`[seed] Created tasks: ${index}/${target.tasks}`);
    }
  }

  for (let i = 0; i < target.communications; i += 1) {
    const clientId = createdClientIds[i % createdClientIds.length];
    const index = i + 1;
    const communication = await apiJson(
      apiBaseUrl,
      '/communications',
      auth.accessToken,
      auth.csrfToken,
      auth.cookieHeader,
      'POST',
      {
        clientId,
        type: 'EMAIL',
        subject: `${prefix}COMM_${index} Subject`,
        body: `${prefix}COMM_${index} body content for search/filter stress coverage.`,
      }
    );
    createdCommunicationIds.push(communication.id);
    if ((index % 200) === 0 || index === target.communications) {
      console.log(`[seed] Created communications: ${index}/${target.communications}`);
    }
  }

  const summary = {
    runId,
    scaleRequested: scale,
    scaleApplied: fallbackTriggered ? '30x' : scale,
    fallbackTriggered,
    fallbackReason,
    apiBaseUrl,
    prefix,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    createdBy: auth.user?.email || DEFAULT_EMAIL,
    seedUserEmail: auth.user?.email || email,
    counts: {
      clients: createdClientIds.length,
      notes: createdNoteIds.length,
      tasks: createdTaskIds.length,
      communications: createdCommunicationIds.length,
    },
    clientIds: createdClientIds,
  };

  const summaryPath = path.join(outputDir, 'seed-summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  console.log(`[seed] Summary written: ${summaryPath}`);
}

main().catch((error) => {
  console.error('[seed] Failed:', error);
  process.exit(1);
});
