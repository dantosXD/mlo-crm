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

  // Create Processor user
  const processorPassword = await bcrypt.hash('password123', 12);
  const processor = await prisma.user.upsert({
    where: { email: 'processor@example.com' },
    update: {},
    create: {
      email: 'processor@example.com',
      passwordHash: processorPassword,
      name: 'Sarah Processor',
      role: 'PROCESSOR',
    },
  });
  console.log(`Created processor user: ${processor.email}`);

  // Create Underwriter user
  const underwriterPassword = await bcrypt.hash('password123', 12);
  const underwriter = await prisma.user.upsert({
    where: { email: 'underwriter@example.com' },
    update: {},
    create: {
      email: 'underwriter@example.com',
      passwordHash: underwriterPassword,
      name: 'Mike Underwriter',
      role: 'UNDERWRITER',
    },
  });
  console.log(`Created underwriter user: ${underwriter.email}`);

  // Create Viewer user
  const viewerPassword = await bcrypt.hash('password123', 12);
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@example.com' },
    update: {},
    create: {
      email: 'viewer@example.com',
      passwordHash: viewerPassword,
      name: 'View Only',
      role: 'VIEWER',
    },
  });
  console.log(`Created viewer user: ${viewer.email}`);

  console.log('Database seeding completed!');
  console.log('');
  console.log('Test credentials:');
  console.log('  Admin: admin@example.com / password123');
  console.log('  MLO:   mlo@example.com / password123');
  console.log('  Manager: manager@example.com / password123');
  console.log('  Processor: processor@example.com / password123');
  console.log('  Underwriter: underwriter@example.com / password123');
  console.log('  Viewer: viewer@example.com / password123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
