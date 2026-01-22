import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestNotification() {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: 'b6698386-7930-4bd5-8d9d-3dd209404c89', // testuser236
        type: 'DOCUMENT_REMINDER',
        title: 'Document Due Tomorrow: TEST_DOCUMENT_236_W2_Form',
        message: 'The document "TEST_DOCUMENT_236_W2_Form" is due tomorrow (January 23, 2026).',
        link: '/documents',
        isRead: false,
      },
    });

    console.log('✅ Test notification created:', JSON.stringify(notification, null, 2));
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestNotification();
