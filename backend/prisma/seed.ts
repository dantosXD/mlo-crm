import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('password123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create MLO user
  const mloPassword = await bcrypt.hash('password123', 12);
  const mlo = await prisma.user.upsert({
    where: { email: 'mlo@example.com' },
    update: {},
    create: {
      email: 'mlo@example.com',
      passwordHash: mloPassword,
      name: 'John Smith',
      role: 'MLO',
    },
  });
  console.log(`Created MLO user: ${mlo.email}`);

  // Create Manager user
  const managerPassword = await bcrypt.hash('password123', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      passwordHash: managerPassword,
      name: 'Jane Doe',
      role: 'MANAGER',
    },
  });
  console.log(`Created manager user: ${manager.email}`);

  console.log('Database seeding completed!');
  console.log('');
  console.log('Test credentials:');
  console.log('  Admin: admin@example.com / password123');
  console.log('  MLO:   mlo@example.com / password123');
  console.log('  Manager: manager@example.com / password123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
