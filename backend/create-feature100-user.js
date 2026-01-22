import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createFeature100User() {
  try {
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: 'feature100@example.com' }
    });

    if (user) {
      console.log('User already exists:', user.email);
    } else {
      // Create user
      const hashedPassword = await bcrypt.hash('password123', 12);
      user = await prisma.user.create({
        data: {
          email: 'feature100@example.com',
          passwordHash: hashedPassword,
          name: 'Feature 100 Test User',
          role: 'MLO',
          isActive: true
        }
      });
      console.log('Created user:', user.email);
      console.log('User ID:', user.id);
    }

    // Return the user ID
    console.log('\nUser ID for token:', user.id);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createFeature100User();
