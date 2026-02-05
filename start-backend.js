const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');
const logFile = path.join(__dirname, 'backend-dev-calendar-share.log');

console.log('Starting backend server...');
console.log('Log file:', logFile);

const out = fs.openSync(logFile, 'a');
const err = fs.openSync(logFile, 'a');

const backend = spawn('npm', ['run', 'dev'], {
  cwd: backendDir,
  detached: true,
  stdio: ['ignore', out, err],
  shell: true
});

backend.unref();

fs.writeFileSync(path.join(__dirname, 'backend-dev.pid'), backend.pid.toString());

console.log(`Backend server started (PID: ${backend.pid})`);
console.log('API URL: http://localhost:3000');
console.log('Check logs in:', logFile);
