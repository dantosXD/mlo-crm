#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const rootDir = process.cwd();

function loadEnvironment() {
  const rootEnv = path.join(rootDir, '.env');
  const backendEnv = path.join(rootDir, 'backend', '.env');

  if (existsSync(rootEnv)) {
    loadEnv({ path: rootEnv, override: true });
  }
  if (existsSync(backendEnv)) {
    loadEnv({ path: backendEnv, override: false });
  }
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function pickFreePort(start, maxAttempts = 20) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = start + offset;
    const available = await canListen(candidate);
    if (available) {
      return candidate;
    }
  }

  return null;
}

async function main() {
  loadEnvironment();

  const failures = [];
  const warnings = [];

  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    failures.push('DATABASE_URL is missing.');
  }

  const isSqlite = dbUrl.startsWith('file:');
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
  if (!isSqlite && !isPostgres) {
    failures.push('DATABASE_URL must start with file:, postgresql://, or postgres://');
  }

  const backendPort = parsePort(process.env.PORT, 3002);
  const frontendPort = parsePort(process.env.VITE_PORT || process.env.FRONTEND_PORT, 5173);

  const backendPortResolved = await pickFreePort(backendPort);
  const frontendPortResolved = await pickFreePort(frontendPort);

  const backendPortFree = backendPortResolved === backendPort;
  const frontendPortFree = frontendPortResolved === frontendPort;

  if (backendPortResolved === null) {
    failures.push(`No fallback backend port available in range ${backendPort}-${backendPort + 19}.`);
  } else if (!backendPortFree) {
    warnings.push(`Configured backend PORT ${backendPort} is occupied; fallback ${backendPortResolved} will be used by dev startup.`);
  }
  if (frontendPortResolved === null) {
    failures.push(`No fallback frontend port available in range ${frontendPort}-${frontendPort + 19}.`);
  } else if (!frontendPortFree) {
    warnings.push(`Configured frontend VITE_PORT ${frontendPort} is occupied; fallback ${frontendPortResolved} will be used by dev startup.`);
  }

  const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;
  const apiUrl = process.env.API_URL || `http://localhost:${backendPort}`;

  console.log('--- Dev Preflight ---');
  console.log(`DATABASE_URL: ${dbUrl || '(missing)'}`);
  console.log(`FRONTEND_URL: ${frontendUrl}`);
  console.log(`API_URL: ${apiUrl}`);
  console.log(`Backend PORT target: ${backendPort} (${backendPortFree ? 'available' : 'occupied'})`);
  if (backendPortResolved !== null && !backendPortFree) {
    console.log(`Backend PORT fallback: ${backendPortResolved}`);
  }
  console.log(`Frontend PORT target: ${frontendPort} (${frontendPortFree ? 'available' : 'occupied'})`);
  if (frontendPortResolved !== null && !frontendPortFree) {
    console.log(`Frontend PORT fallback: ${frontendPortResolved}`);
  }

  if (warnings.length) {
    console.log('\nPreflight warnings:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (failures.length) {
    console.error('\nPreflight failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('\nPreflight passed. Environment is ready for local launch.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
