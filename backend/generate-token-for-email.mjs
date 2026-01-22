import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config({ path: '../.env' });

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production-min-32-chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const email = process.argv[2] || 'manager@example.com';

(async () => {
  try {
    // Get user by email
    const user = await prisma.user.findFirst({
      where: { email: email, isActive: true },
      select: { id: true, email: true, role: true, name: true }
    });

    if (!user) {
      console.log(`No active user found with email: ${email}`);
      process.exit(1);
    }

    console.log('Found user:', user);

    // Generate token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log('\nGenerated JWT Token:');
    console.log(token);
    console.log('\nToken payload:', JSON.stringify(jwt.decode(token), null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
