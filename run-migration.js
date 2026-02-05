const { execSync } = require('child_process');
const path = require('path');

console.log('Running Prisma database migration...');
console.log('=====================================\n');

const backendDir = path.join(__dirname, 'backend');

try {
  console.log('Changing to backend directory...');
  process.chdir(backendDir);

  console.log('Running: npx prisma db push');
  const output = execSync('npx prisma db push', {
    stdio: 'inherit',
    encoding: 'utf-8'
  });

  console.log('\n✓ Database migration completed successfully!');
} catch (error) {
  console.error('\n✗ Migration failed:', error.message);
  process.exit(1);
}
