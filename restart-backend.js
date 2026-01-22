const { execSync } = require('child_process');

try {
  // Find and kill the process on port 3000
  const output = execSync('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf8' });
  const lines = output.trim().split('\n');

  if (lines.length > 0 && lines[0]) {
    const parts = lines[0].trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    console.log(`Killing backend process ${pid}...`);
    execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
    console.log('Backend process killed.');
  }

  // Start backend in background
  console.log('Starting backend...');
  execSync('start /B cmd /c "cd backend && npm run dev > backend.log 2>&1"', { encoding: 'utf8' });
  console.log('Backend restarted successfully.');
} catch (error) {
  console.error('Error:', error.message);
}
