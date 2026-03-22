#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = process.cwd();

const processes = [];

const internalDefaults = {
  AUTH_SERVICE_URL: 'http://127.0.0.1:3001/api/v1',
  AUCTION_SERVICE_URL: 'http://127.0.0.1:3002/api/v1',
  MATCH_SERVICE_URL: 'http://127.0.0.1:3003/api/v1',
  STATS_SERVICE_URL: 'http://127.0.0.1:3004/api/v1'
};

for (const [key, value] of Object.entries(internalDefaults)) {
  if (!process.env[key]) process.env[key] = value;
}

const serviceList = [
  { name: 'auth-service', script: 'apps/auth-service/dist/apps/auth-service/src/main.js', env: { PORT: '3001' } },
  { name: 'auction-service', script: 'apps/auction-service/dist/apps/auction-service/src/main.js', env: { PORT: '3002' } },
  { name: 'match-engine-service', script: 'apps/match-engine-service/dist/apps/match-engine-service/src/main.js', env: { PORT: '3003' } },
  { name: 'stats-service', script: 'apps/stats-service/dist/apps/stats-service/src/main.js', env: { PORT: '3004' } },
  { name: 'api-gateway', script: 'apps/api-gateway/dist/apps/api-gateway/src/main.js', env: { PORT: process.env.PORT || '10000' } }
];

function runMigrations() {
  if (process.env.SKIP_MIGRATIONS === 'true') return;

  const result = spawnSync('npm', ['run', 'prisma:migrate'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  if (result.status !== 0) {
    console.error('[mvp-backend] Prisma migration failed. Aborting startup.');
    process.exit(result.status || 1);
  }
}

function spawnService(service) {
  const scriptPath = path.join(root, service.script);
  if (!fs.existsSync(scriptPath)) {
    console.error(`[mvp-backend] Missing build artifact: ${service.script}`);
    process.exit(1);
  }

  const child = spawn('node', [scriptPath], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...service.env
    }
  });

  child.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`[mvp-backend] ${service.name} exited with code ${code ?? 'null'} signal ${signal ?? 'none'}`);
      shutdown(1);
    }
  });

  processes.push(child);
}

function shutdown(exitCode = 0) {
  for (const proc of processes) {
    if (!proc.killed) proc.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 350);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

runMigrations();
for (const service of serviceList) spawnService(service);

console.log(`[mvp-backend] Started ${serviceList.length} internal services. Public API port: ${process.env.PORT || '10000'}`);
