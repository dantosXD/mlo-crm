import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getUserId() {
  try {
    // Get any user from the database
    const user = await prisma.user.findFirst({
      select: { id: true, email: true, name: true }
    });

    if (user) {
      console.log(`USER_ID=${user.id}`);
      console.log(`USER_EMAIL=${user.email}`);
      console.log(`USER_NAME=${user.name}`);
    } else {
      console.log('ERROR: No users found in database');
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getUserId();
