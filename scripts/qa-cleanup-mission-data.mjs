#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_API_BASE_URL = process.env.QA_API_BASE_URL || 'http://127.0.0.1:3002/api';
const DEFAULT_EMAIL = process.env.QA_SEED_EMAIL || 'mlo@example.com';
const DEFAULT_PASSWORD = process.env.QA_SEED_PASSWORD || 'password123';

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(apiBaseUrl, email, password) {
  const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    const text = await loginResponse.text();
    throw new Error(`Login failed (${loginResponse.status}): ${text}`);
  }
  const loginData = await loginResponse.json();
  const loginCookies =
    typeof loginResponse.headers.getSetCookie === 'function'
      ? loginResponse.headers.getSetCookie()
      : [];
  const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
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
  return {
    accessToken: loginData.accessToken,
    csrfToken: meResponse.headers.get('x-csrf-token') || '',
    cookieHeader,
  };
}

async function apiDelete(apiBaseUrl, endpoint, token, csrfToken, cookieHeader) {
  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrfToken,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DELETE ${endpoint} failed (${response.status}): ${text}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const runId = args.runId;
  const apiBaseUrl = args.apiBaseUrl || DEFAULT_API_BASE_URL;

  if (!runId) {
    throw new Error('Missing --runId');
  }

  const summaryPath = path.resolve('output/playwright/mlo-mission', runId, 'seed-summary.json');
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Seed summary not found: ${summaryPath}`);
  }

  const seedSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  const email = args.email || seedSummary.seedUserEmail || DEFAULT_EMAIL;
  const password = args.password || DEFAULT_PASSWORD;
  const clientIds = Array.isArray(seedSummary.clientIds) ? seedSummary.clientIds : [];
  if (clientIds.length === 0) {
    console.log('[cleanup] No client IDs found in seed summary; nothing to clean.');
    return;
  }

  const auth = await login(apiBaseUrl, email, password);
  let deleted = 0;
  const failures = [];

  for (let i = 0; i < clientIds.length; i += 1) {
    const clientId = clientIds[i];
    try {
      await apiDelete(apiBaseUrl, `/clients/${clientId}`, auth.accessToken, auth.csrfToken, auth.cookieHeader);
      deleted += 1;
    } catch (error) {
      failures.push({ clientId, error: error instanceof Error ? error.message : String(error) });
    }

    if (((i + 1) % 100) === 0 || (i + 1) === clientIds.length) {
      console.log(`[cleanup] Processed ${i + 1}/${clientIds.length} client deletes`);
    }

    if ((i + 1) % 50 === 0) {
      await sleep(100);
    }
  }

  const cleanupSummary = {
    runId,
    apiBaseUrl,
    deleted,
    failed: failures.length,
    failures,
    finishedAt: new Date().toISOString(),
  };

  const cleanupSummaryPath = path.resolve('output/playwright/mlo-mission', runId, 'cleanup-summary.json');
  fs.writeFileSync(cleanupSummaryPath, `${JSON.stringify(cleanupSummary, null, 2)}\n`, 'utf-8');
  console.log(`[cleanup] Summary written: ${cleanupSummaryPath}`);
}

main().catch((error) => {
  console.error('[cleanup] Failed:', error);
  process.exit(1);
});
