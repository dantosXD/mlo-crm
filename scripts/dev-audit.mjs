#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
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

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function pickFreePort(start, maxAttempts = 20) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = start + offset;
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
    console.log(`[preflight] Port ${candidate} is occupied, checking next port.`);
  }

  throw new Error(`No free port found in range ${start}-${start + maxAttempts - 1}`);
}

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function spawnChild(command, args, options) {
  const env = Object.fromEntries(
    Object.entries(options.env || process.env)
      .filter(([, value]) => value !== undefined)
  );

  const child = spawn(command, args, {
    cwd: options.cwd,
    env,
    shell: true,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[${options.label}] exited with code ${code}`);
    }
  });

  child.on('error', (error) => {
    console.error(`[${options.label}] failed to start:`, error);
  });

  return child;
}

async function main() {
  loadEnvironment();

  const requestedBackendPort = toNumber(process.env.PORT, 3002);
  const requestedFrontendPort = toNumber(process.env.VITE_PORT || process.env.FRONTEND_PORT, 5173);

  const backendPort = await pickFreePort(requestedBackendPort);
  const frontendPort = await pickFreePort(requestedFrontendPort);

  if (backendPort !== requestedBackendPort) {
    console.log(`[preflight] Backend port adjusted from ${requestedBackendPort} -> ${backendPort}`);
  }

  if (frontendPort !== requestedFrontendPort) {
    console.log(`[preflight] Frontend port adjusted from ${requestedFrontendPort} -> ${frontendPort}`);
  }

  const apiBase = `http://localhost:${backendPort}`;

  const backendEnv = {
    ...process.env,
    PORT: String(backendPort),
    FRONTEND_URL: `http://localhost:${frontendPort}`,
    API_URL: apiBase,
  };

  const frontendEnv = {
    ...process.env,
    PORT: String(frontendPort),
    VITE_API_URL: apiBase,
    API_URL: apiBase,
  };

  console.log(`\nStarting backend on ${apiBase}`);
  console.log(`Starting frontend on http://localhost:${frontendPort}`);

  const backendChild = spawnChild(npmCommand(),
    ['run', 'dev'],
    {
      cwd: path.join(rootDir, 'backend'),
      env: backendEnv,
      label: 'backend',
    });

  const frontendChild = spawnChild(npmCommand(),
    ['run', 'dev', '--', '--port', String(frontendPort)],
    {
      cwd: path.join(rootDir, 'frontend'),
      env: frontendEnv,
      label: 'frontend',
    });

  const shutdown = (signal) => {
    console.log(`\n[shutdown] Received ${signal}. Stopping services...`);
    backendChild.kill();
    frontendChild.kill();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  backendChild.on('exit', (code) => {
    if (code !== 0) {
      frontendChild.kill();
      process.exit(code || 1);
    }
  });

  frontendChild.on('exit', (code) => {
    if (code !== 0) {
      backendChild.kill();
      process.exit(code || 1);
    }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
