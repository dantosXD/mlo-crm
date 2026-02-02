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

  // Create communication templates for workflows
  console.log('Creating communication templates...');

  // New Lead Welcome Email Template
  const welcomeEmailTemplate = await prisma.communicationTemplate.upsert({
    where: { id: 'welcome-email-template' },
    update: {},
    create: {
      id: 'welcome-email-template',
      name: 'New Lead Welcome Email',
      type: 'EMAIL',
      category: 'WELCOME',
      subject: 'Welcome to Our Mortgage Team!',
      body: `Dear {{client_name}},

Thank you for considering us for your mortgage needs! I'm excited to work with you on your journey to homeownership.

As your Mortgage Loan Officer, I'm here to guide you through every step of the process and answer any questions you may have.

Next Steps:
1. Complete your initial application
2. Gather necessary documents (pay stubs, tax returns, bank statements)
3. Schedule a consultation to discuss your options

I'll be reaching out soon to discuss your goals and create a personalized plan for your success.

Best regards,
{{loan_officer_name}}
{{company_name}}

If you have any immediate questions, feel free to reply to this email or call me at {{loan_officer_phone}}.`,
      placeholders: JSON.stringify(['client_name', 'loan_officer_name', 'company_name', 'loan_officer_phone']),
      isActive: true,
    },
  });
  console.log(`Created communication template: ${welcomeEmailTemplate.name}`);

  // Document Reminder Email Template
  const documentReminderTemplate = await prisma.communicationTemplate.upsert({
    where: { id: 'document-reminder-template' },
    update: {},
    create: {
      id: 'document-reminder-template',
      name: 'Document Collection Reminder',
      type: 'EMAIL',
      category: 'REMINDER',
      subject: 'Action Required: Documents Needed for Your Application',
      body: `Dear {{client_name}},

This is a friendly reminder that we are still waiting for the following document(s):

{{document_list}}

These documents are required to move forward with your application. Please upload them to your portal as soon as possible.

If you have any questions about what's needed or need assistance uploading, please don't hesitate to reach out.

Due date: {{due_date}}

Best regards,
{{loan_officer_name}}
{{company_name}}`,
      placeholders: JSON.stringify(['client_name', 'document_list', 'due_date', 'loan_officer_name', 'company_name']),
      isActive: true,
    },
  });
  console.log(`Created communication template: ${documentReminderTemplate.name}`);

  // Status Update Email Template
  const statusUpdateTemplate = await prisma.communicationTemplate.upsert({
    where: { id: 'status-update-template' },
    update: {},
    create: {
      id: 'status-update-template',
      name: 'Client Status Update Notification',
      type: 'EMAIL',
      category: 'STATUS_UPDATE',
      subject: 'Your Application Status Has Been Updated',
      body: `Dear {{client_name}},

Great news! Your mortgage application status has been updated to: {{new_status}}

{{status_description}}

What this means:
{{next_steps}}

If you have any questions about this status update or what's required next, please reach out.

View your application status in your portal: {{portal_url}}

Best regards,
{{loan_officer_name}}
{{company_name}}`,
      placeholders: JSON.stringify(['client_name', 'new_status', 'status_description', 'next_steps', 'portal_url', 'loan_officer_name', 'company_name']),
      isActive: true,
    },
  });
  console.log(`Created communication template: ${statusUpdateTemplate.name}`);

  // Create workflow templates
  console.log('Creating workflow templates...');

  // Workflow #1: New Lead Welcome
  const newLeadWelcomeWorkflow = await prisma.workflow.upsert({
    where: { id: 'new-lead-welcome-workflow' },
    update: {},
    create: {
      id: 'new-lead-welcome-workflow',
      name: 'New Lead Welcome Sequence',
      description: 'Automatically welcomes new leads with an email, creates a follow-up task, and notifies the MLO',
      isActive: true,
      isTemplate: true,
      triggerType: 'CLIENT_CREATED',
      triggerConfig: null,
      conditions: JSON.stringify({
        type: 'AND',
        rules: [
          {
            field: 'status',
            operator: 'equals',
            value: 'LEAD',
          },
        ],
      }),
      actions: JSON.stringify([
        {
          type: 'SEND_EMAIL',
          order: 1,
          config: {
            templateId: 'welcome-email-template',
            to: '{{client_email}}',
          },
        },
        {
          type: 'CREATE_TASK',
          order: 2,
          config: {
            text: 'Follow up call with new lead {{client_name}}',
            priority: 'HIGH',
            dueDateDays: 1,
            assignedTo: '{{created_by_id}}',
          },
        },
        {
          type: 'SEND_NOTIFICATION',
          order: 3,
          config: {
            recipient: '{{created_by_id}}',
            title: 'New Lead Created',
            message: 'New lead {{client_name}} has been added to your pipeline. A welcome email has been sent.',
            type: 'INFO',
          },
        },
      ]),
      version: 1,
      createdById: admin.id,
    },
  });
  console.log(`Created workflow template: ${newLeadWelcomeWorkflow.name}`);

  // Workflow #2: Document Collection Follow-up
  const documentCollectionWorkflow = await prisma.workflow.upsert({
    where: { id: 'document-collection-workflow' },
    update: {},
    create: {
      id: 'document-collection-workflow',
      name: 'Document Collection Reminder',
      description: 'Sends reminder emails when documents are due and creates follow-up tasks',
      isActive: true,
      isTemplate: true,
      triggerType: 'DOCUMENT_DUE_DATE',
      triggerConfig: JSON.stringify({
        daysBefore: 3,
      }),
      conditions: JSON.stringify({
        type: 'AND',
        rules: [
          {
            field: 'document_status',
            operator: 'not_equals',
            value: 'UPLOADED',
          },
        ],
      }),
      actions: JSON.stringify([
        {
          type: 'SEND_EMAIL',
          order: 1,
          config: {
            templateId: 'document-reminder-template',
            to: '{{client_email}}',
          },
        },
        {
          type: 'CREATE_TASK',
          order: 2,
          config: {
            text: 'Follow up on document request for {{client_name}} - {{document_name}}',
            priority: 'MEDIUM',
            dueDateDays: 2,
            assignedTo: '{{created_by_id}}',
          },
        },
        {
          type: 'WAIT',
          order: 3,
          config: {
            duration: 86400000, // 24 hours in milliseconds
            description: 'Wait 24 hours before sending another reminder',
          },
        },
        {
          type: 'SEND_EMAIL',
          order: 4,
          config: {
            templateId: 'document-reminder-template',
            to: '{{client_email}}',
          },
        },
      ]),
      version: 1,
      createdById: admin.id,
    },
  });
  console.log(`Created workflow template: ${documentCollectionWorkflow.name}`);

  // Workflow #3: Status Update Notifications
  const statusUpdateWorkflow = await prisma.workflow.upsert({
    where: { id: 'status-update-workflow' },
    update: {},
    create: {
      id: 'status-update-workflow',
      name: 'Client Status Update Notification',
      description: 'Notifies clients when their application status changes',
      isActive: true,
      isTemplate: true,
      triggerType: 'CLIENT_STATUS_CHANGED',
      triggerConfig: JSON.stringify({
        // Any status change triggers this workflow
      }),
      conditions: null, // No conditions - applies to all status changes
      actions: JSON.stringify([
        {
          type: 'SEND_EMAIL',
          order: 1,
          config: {
            templateId: 'status-update-template',
            to: '{{client_email}}',
            subjectOverride: 'Your application status is now: {{new_status}}',
          },
        },
        {
          type: 'CREATE_NOTE',
          order: 2,
          config: {
            text: 'Status update notification sent to client. Status changed from {{old_status}} to {{new_status}}',
            tags: ['status_change', 'notification_sent'],
          },
        },
      ]),
      version: 1,
      createdById: admin.id,
    },
  });
  console.log(`Created workflow template: ${statusUpdateWorkflow.name}`);

  console.log('Database seeding completed!');
  console.log('');
  console.log('Test credentials:');
  console.log('  Admin: admin@example.com / password123');
  console.log('  MLO:   mlo@example.com / password123');
  console.log('  Manager: manager@example.com / password123');
  console.log('  Processor: processor@example.com / password123');
  console.log('  Underwriter: underwriter@example.com / password123');
  console.log('  Viewer: viewer@example.com / password123');
  console.log('');
  console.log('Workflow Templates Created:');
  console.log('  1. New Lead Welcome Sequence (CLIENT_CREATED trigger)');
  console.log('  2. Document Collection Reminder (DOCUMENT_DUE_DATE trigger)');
  console.log('  3. Status Update Notification (CLIENT_STATUS_CHANGED trigger)');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
