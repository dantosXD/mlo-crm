#!/usr/bin/env node

function readArg(flag) {
  const found = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!found) {
    return null;
  }
  return found.slice(flag.length + 1);
}

function normalizeBaseUrl(rawBaseUrl) {
  return rawBaseUrl.replace(/\/+$/, '');
}

async function fetchJson(url, expectedStatus) {
  const response = await fetch(url);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected ${url} to return ${expectedStatus}, received ${response.status} with body ${JSON.stringify(body)}`
    );
  }

  return body;
}

async function main() {
  const baseUrl = readArg('--base-url') || process.env.STAGING_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing staging base URL. Set STAGING_BASE_URL or pass --base-url=<url>.');
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  console.log(`Running staging smoke checks against ${normalizedBaseUrl}`);

  const live = await fetchJson(`${normalizedBaseUrl}/health/live`, 200);
  if (live?.status !== 'live') {
    throw new Error(`Unexpected /health/live payload: ${JSON.stringify(live)}`);
  }

  const ready = await fetchJson(`${normalizedBaseUrl}/health/ready`, 200);
  if (ready?.status !== 'ready') {
    throw new Error(`Unexpected /health/ready payload: ${JSON.stringify(ready)}`);
  }

  const metrics = await fetchJson(`${normalizedBaseUrl}/health/metrics`, 200);
  if (!metrics?.timestamp) {
    throw new Error(`Unexpected /health/metrics payload: ${JSON.stringify(metrics)}`);
  }

  console.log('Staging smoke checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
