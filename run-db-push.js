const { execSync } = require('child_process');
const path = require('path');

try {
  const backendPath = path.join(__dirname, 'backend');
  console.log('Running Prisma db push from:', backendPath);

  const result = execSync(
    'npx prisma db push',
    {
      cwd: backendPath,
      stdio: 'inherit'
    }
  );

  console.log('Database push completed successfully');
} catch (error) {
  console.error('Database push failed:', error.message);
  process.exit(1);
}
