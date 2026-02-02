/**
 * Promote testadmin@mlodash.com to ADMIN role using Prisma
 */
import { PrismaClient } from './backend/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

async function promoteUser() {
  try {
    const user = await prisma.user.update({
      where: { email: 'testadmin@mlodash.com' },
      data: { role: 'ADMIN' },
    });

    console.log('✓ User promoted to ADMIN');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

promoteUser();
