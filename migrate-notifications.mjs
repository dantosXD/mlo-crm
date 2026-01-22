import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backendDir = join(__dirname, 'backend');

console.log('Changing to backend directory...');
process.chdir(backendDir);

console.log('Running Prisma db push...');
try {
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('\n✅ Migration successful!');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
