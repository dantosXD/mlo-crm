import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backendDir = join(__dirname, 'backend');

console.log('Changing to backend directory...');
process.chdir(backendDir);

console.log('Running document reminder job...');
try {
  execSync('npx tsx src/jobs/documentReminderJob.ts', { stdio: 'inherit' });
  console.log('\n✅ Reminder job completed!');
} catch (error) {
  console.error('\n❌ Reminder job failed:', error.message);
  process.exit(1);
}
