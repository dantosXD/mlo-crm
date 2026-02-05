const { execSync } = require('child_process');
const path = require('path');

try {
  const backendPath = path.join(__dirname, 'backend');
  console.log('Running Prisma migration from:', backendPath);

  const result = execSync(
    'npx prisma migrate dev --name add_task_enhancements_feature320',
    {
      cwd: backendPath,
      stdio: 'inherit'
    }
  );

  console.log('Migration completed successfully');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
