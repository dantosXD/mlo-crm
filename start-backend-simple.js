const { spawn } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');
const backendProcess = spawn('npm', ['start'], {
  cwd: backendDir,
  shell: true,
  stdio: 'inherit',
  detached: true
});

backendProcess.on('error', (err) => {
  console.error('Failed to start backend:', err);
});

backendProcess.on('exit', (code) => {
  console.log(`Backend process exited with code ${code}`);
});

console.log(`Backend started with PID: ${backendProcess.pid}`);

// Write PID to file
require('fs').writeFileSync(__dirname + '/backend.pid', backendProcess.pid.toString());

backendProcess.unref();
