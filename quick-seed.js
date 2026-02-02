import { PrismaClient } from './backend/node_modules/@prisma/client/index.js';
import bcrypt from './backend/node_modules/bcryptjs/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with test users...');

  const users = [
    { email: 'admin@example.com', password: 'password123', name: 'Admin User', role: 'ADMIN' },
    { email: 'mlo@example.com', password: 'password123', name: 'John Smith', role: 'MLO' },
    { email: 'manager@example.com', password: 'password123', name: 'Jane Doe', role: 'MANAGER' },
    { email: 'processor@example.com', password: 'password123', name: 'Sarah Processor', role: 'PROCESSOR' },
    { email: 'underwriter@example.com', password: 'password123', name: 'Mike Underwriter', role: 'UNDERWRITER' },
  ];

  for (const userData of users) {
    const passwordHash = await bcrypt.hash(userData.password, 12);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        passwordHash,
        name: userData.name,
        role: userData.role,
      },
    });

    console.log(`✅ Created user: ${user.email} (${user.role})`);
  }

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📝 Test credentials:');
  console.log('   Email: admin@example.com');
  console.log('   Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
