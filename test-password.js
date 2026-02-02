import { PrismaClient } from './backend/node_modules/@prisma/client/index.js';
import bcrypt from './backend/node_modules/bcryptjs/index.js';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });

  if (!admin) {
    console.log('❌ Admin user not found');
    return;
  }

  console.log('🔑 Testing password "password123" against admin user hash...');
  const isValid = await bcrypt.compare('password123', admin.passwordHash);
  console.log('Result:', isValid ? '✅ VALID' : '❌ INVALID');

  if (!isValid) {
    console.log('\n🔄 Updating password hash...');
    const newPasswordHash = await bcrypt.hash('password123', 12);
    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { passwordHash: newPasswordHash }
    });
    console.log('✅ Password updated');

    // Test again
    const updatedUser = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });
    const isValidNow = await bcrypt.compare('password123', updatedUser.passwordHash);
    console.log('New password test:', isValidNow ? '✅ VALID' : '❌ INVALID');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
