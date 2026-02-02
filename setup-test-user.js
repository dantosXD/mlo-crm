/**
 * Quick script to create test admin user
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupTestUser() {
  try {
    // Check if admin user exists
    let admin = await prisma.user.findUnique({
      where: { email: 'admin@mlodash.com' },
    });

    if (admin) {
      console.log('Admin user already exists, updating password...');
      const passwordHash = await bcrypt.hash('admin123', 12);
      admin = await prisma.user.update({
        where: { email: 'admin@mlodash.com' },
        data: { passwordHash },
      });
    } else {
      console.log('Creating admin user...');
      const passwordHash = await bcrypt.hash('admin123', 12);
      admin = await prisma.user.create({
        data: {
          email: 'admin@mlodash.com',
          passwordHash,
          name: 'Admin User',
          role: 'ADMIN',
          isActive: true,
        },
      });
    }

    console.log('✓ Admin user ready');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.name}`);
    console.log(`  Role: ${admin.role}`);
    console.log('  Password: admin123');
  } catch (error) {
    console.error('✗ Error setting up test user:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestUser();
