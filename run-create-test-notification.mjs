import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backendDir = join(__dirname, 'backend');

console.log('Changing to backend directory...');
process.chdir(backendDir);

console.log('Creating test notification...');
try {
  execSync('node ../create-test-notification.mjs', { stdio: 'inherit' });
} catch (error) {
  console.error('\n❌ Failed:', error.message);
}
